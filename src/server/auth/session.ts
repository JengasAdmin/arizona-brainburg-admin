import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ab_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  /** user id */
  sub: string;
  /** token version — bump to revoke every session of a user */
  tv: number;
  iat: number;
  exp: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env.local / Vercel env vars.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Called from the OAuth callback (Route Handler / Server Action). */
export async function setSessionCookie(userId: number, tokenVersion: number): Promise<void> {
  const token = await new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Verify the session cookie (signature + expiry only; DB checks happen in `access.ts`). */
export async function readSessionToken(): Promise<{ userId: number; tokenVersion: number } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    const userId = Number.parseInt(payload.sub, 10);
    if (!Number.isFinite(userId)) return null;
    return { userId, tokenVersion: typeof payload.tv === "number" ? payload.tv : 0 };
  } catch {
    return null;
  }
}
