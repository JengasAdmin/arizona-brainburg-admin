import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, servers, users, userRoles, roles } from "@/db/schema";
import { errors, getClientIp } from "@/server/http";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";
import { readSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../session";
import { PROVIDERS, randomToken, type ProviderKey } from "./providers";

export const OAUTH_STATE_COOKIE = "ab_oauth";
const STATE_TTL_SECONDS = 600; // 10 minutes

interface StateData {
  state: string;
  provider: ProviderKey;
  mode: "login" | "link";
  linkUserId?: number;
  codeVerifier?: string;
  redirectTo: string;
  exp: number;
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  } as const;
}

/** Only allow internal redirect targets — prevents open-redirect vulnerabilities. */
export function safeRedirect(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export function isAllowlisted(provider: ProviderKey, providerAccountId: string): boolean {
  const envKey = provider === "discord" ? "ALLOWLIST_DISCORD_IDS" : "ALLOWLIST_VK_IDS";
  const raw = process.env[envKey];
  if (!raw || raw.trim() === "") return true; // no allowlist configured → everyone may sign in
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(providerAccountId);
}

/** Step 1 — redirect the user to the OAuth provider with a signed state cookie. */
export function beginOAuth(params: {
  provider: ProviderKey;
  mode: "login" | "link";
  linkUserId?: number;
  redirectTo?: string | null;
  codeVerifier?: string;
}): NextResponse {
  // Rate limiting happens in the route (`/api/auth/:provider`), keyed per client IP.
  // A shared bucket here would be global across all users — one abuser could lock everyone out.

  const state = randomToken(24);
  const data: StateData = {
    state,
    provider: params.provider,
    mode: params.mode,
    linkUserId: params.linkUserId,
    codeVerifier: params.codeVerifier,
    redirectTo: safeRedirect(params.redirectTo),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };

  const provider = PROVIDERS[params.provider];
  const redirectUri =
    params.provider === "discord"
      ? process.env.DISCORD_REDIRECT_URI ?? ""
      : process.env.VK_REDIRECT_URI ?? "";
  if (!redirectUri) throw errors.serviceUnavailable(`OAuth provider ${params.provider} is not configured.`, "OAUTH_NOT_CONFIGURED");

  const url = provider.authorizeUrl({
    redirectUri,
    state,
    codeVerifier: params.codeVerifier,
  });

  const response = NextResponse.redirect(url, 302);
  response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify(data), stateCookieOptions());
  return response;
}

/** Step 2 — validate state, exchange the code, create/find the user, set the session. */
export async function completeOAuth(params: {
  req: NextRequest;
  provider: ProviderKey;
  code: string | null;
  stateParam: string | null;
}): Promise<NextResponse> {
  const { req, provider, code, stateParam } = params;

  const fail = (target: string, error: string) =>
    NextResponse.redirect(new URL(`${target}${target.includes("?") ? "&" : "?"}error=${error}`, req.nextUrl.origin), 302);

  const limit = rateLimit(`oauth-cb:${getClientIp(req)}`, RATE_LIMITS.oauthCallback.limit, RATE_LIMITS.oauthCallback.windowMs);
  if (!limit.ok) throw errors.rateLimited(limit.retryAfterSec);

  const rawState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let state: StateData | null = null;
  if (rawState) {
    try {
      state = JSON.parse(rawState) as StateData;
    } catch {
      state = null; // corrupted cookie — treated as a failed CSRF check below
    }
  }
  const stateResponse = NextResponse.redirect(new URL("/?error=oauth_failed", req.nextUrl.origin), 302);
  stateResponse.cookies.delete(OAUTH_STATE_COOKIE);

  if (
    !code ||
    !state ||
    typeof state.state !== "string" ||
    !stateParam ||
    state.state !== stateParam ||
    state.provider !== provider
  ) {
    return stateResponse; // CSRF / tampered callback
  }
  if (state.exp < Math.floor(Date.now() / 1000)) {
    return fail("/", "session_expired");
  }

  let profile;
  try {
    profile = await PROVIDERS[provider].exchange({
      code,
      redirectUri:
        provider === "discord"
          ? process.env.DISCORD_REDIRECT_URI ?? ""
          : process.env.VK_REDIRECT_URI ?? "",
      codeVerifier: state.codeVerifier,
    });
  } catch (err) {
    console.error("[oauth] exchange failed", err);
    return fail("/", "oauth_failed");
  }

  const session = await readSessionToken();

  try {
    // If a user is already signed in, an unknown identity is treated as LINKING
    // instead of silently creating a duplicate account.
    const mode: "login" | "link" = state.mode === "link" || session ? "link" : "login";

    if (mode === "link") {
      if (!session) return fail("/", "session_expired");
      if (!isAllowlisted(provider, profile.providerAccountId)) return fail("/", "access_denied");

      const existing = await db
        .select({ userId: oauthAccounts.userId })
        .from(oauthAccounts)
        .where(
          and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.providerAccountId)),
        );

      if (existing[0] && existing[0].userId !== session.userId) {
        return fail("/settings", "provider_already_linked");
      }
      if (!existing[0]) {
        await db.insert(oauthAccounts).values({
          userId: session.userId,
          provider,
          providerAccountId: profile.providerAccountId,
          providerUsername: profile.username,
          providerDisplayName: profile.displayName,
          providerAvatarUrl: profile.avatarUrl,
          profile: profile.raw,
        });
      }
      return NextResponse.redirect(new URL("/settings?section=connected", req.nextUrl.origin), 302);
    }

    // ---- login / first registration ----
    if (!isAllowlisted(provider, profile.providerAccountId)) return fail("/", "access_denied");

    const linked = await db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.providerAccountId)),
      );

    let userId: number;
    const now = new Date();

    if (linked[0]) {
      userId = linked[0].userId;
      await db
        .update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, userId));
      await db
        .update(oauthAccounts)
        .set({
          providerUsername: profile.username,
          providerDisplayName: profile.displayName,
          providerAvatarUrl: profile.avatarUrl,
          profile: profile.raw,
          updatedAt: now,
        })
        .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.providerAccountId)));
    } else {
      // First registration — create the account.
      const server = await ensureServer();
      const playerRole = await db.select().from(roles).where(eq(roles.key, "player")).limit(1);
      if (!playerRole[0]) {
        throw errors.serviceUnavailable("Database is not seeded. Run `npm run db:seed`.", "SEED_REQUIRED");
      }

      const inserted = await db
        .insert(users)
        .values({
          displayName: profile.displayName,
          nickname: null,
          avatarUrl: profile.avatarUrl,
          serverId: server.id,
          registrationSource: provider,
          status: "active",
          lastLoginAt: now,
        })
        .returning({ id: users.id });
      userId = inserted[0]!.id;

      await db.insert(oauthAccounts).values({
        userId,
        provider,
        providerAccountId: profile.providerAccountId,
        providerUsername: profile.username,
        providerDisplayName: profile.displayName,
        providerAvatarUrl: profile.avatarUrl,
        profile: profile.raw,
      });
      await db.insert(userRoles).values({ userId, roleId: playerRole[0].id });
    }

    const fresh = await db.select({ tv: users.tokenVersion }).from(users).where(eq(users.id, userId)).limit(1);
    const response = NextResponse.redirect(new URL(state.redirectTo ?? "/dashboard", req.nextUrl.origin), 302);
    response.cookies.set(SESSION_COOKIE, await makeSessionToken(userId, fresh[0]?.tv ?? 0), sessionCookieOptions());
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[oauth] callback failed", err);
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 503) {
      return fail("/", "not_seeded");
    }
    return fail("/", "oauth_failed");
  }
}

async function ensureServer() {
  const existing = await db.select().from(servers).where(eq(servers.serverNumber, 5)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(servers)
    .values({ serverNumber: 5, name: "Arizona RP — Brainburg #5" })
    .returning();
  return inserted[0]!;
}

// Local import to avoid a circular dependency on session.ts helpers.
async function makeSessionToken(userId: number, tokenVersion: number): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}
