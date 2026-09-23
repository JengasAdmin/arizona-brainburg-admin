import "server-only";
import { createHash, randomBytes } from "crypto";

export type ProviderKey = "discord" | "vk";

export interface OAuthProfile {
  provider: ProviderKey;
  providerAccountId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  raw: Record<string, unknown>;
}

export interface OAuthProvider {
  key: ProviderKey;
  /** Build the authorization URL that the user is redirected to. */
  authorizeUrl(params: {
    redirectUri: string;
    state: string;
    codeVerifier?: string;
  }): string;
  /** Exchange the authorization code for a profile. */
  exchange(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthProfile>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/* ---------------------------------- Discord --------------------------------- */

export const discordProvider: OAuthProvider = {
  key: "discord",
  authorizeUrl({ redirectUri, state, codeVerifier }) {
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", required("DISCORD_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    if (codeVerifier) url.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
    if (codeVerifier) url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },
  async exchange({ code, redirectUri, codeVerifier }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: required("DISCORD_CLIENT_ID"),
      client_secret: required("DISCORD_CLIENT_SECRET"),
    });
    if (codeVerifier) body.set("code_verifier", codeVerifier);

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!tokenRes.ok) throw new Error("Discord token exchange failed.");
    const token = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userRes.ok) throw new Error("Discord profile request failed.");
    const profile = (await userRes.json()) as {
      id: string;
      username: string;
      global_name: string | null;
      avatar: string | null;
      discriminator: string;
    };

    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number(profile.discriminator || "0") % 5}.png`;

    return {
      provider: "discord",
      providerAccountId: profile.id,
      username: profile.username,
      displayName: profile.global_name || profile.username,
      avatarUrl,
      raw: profile as unknown as Record<string, unknown>,
    };
  },
};

/* ------------------------------------ VK ------------------------------------ */

/**
 * VK ID (id.vk.com) OAuth 2.0 flow:
 *   authorize → https://id.vk.com/authorize
 *   code exchange → POST https://id.vk.com/oauth2/auth
 *   profile → POST https://id.vk.com/api/oauth2/user_info
 */
export const vkProvider: OAuthProvider = {
  key: "vk",
  authorizeUrl({ redirectUri, state }) {
    const url = new URL("https://id.vk.com/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", required("VK_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "");
    url.searchParams.set("v", "5.199");
    return url.toString();
  },
  async exchange({ code, redirectUri }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: required("VK_CLIENT_ID"),
      client_secret: required("VK_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      v: "5.199",
    });

    const tokenRes = await fetch("https://id.vk.com/oauth2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!tokenRes.ok) throw new Error("VK token exchange failed.");
    const token = (await tokenRes.json()) as { access_token: string };

    const infoRes = await fetch("https://id.vk.com/api/oauth2/user_info", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("VK_CLIENT_ID"),
        access_token: token.access_token,
        v: "5.199",
      }),
      cache: "no-store",
    });
    if (!infoRes.ok) throw new Error("VK profile request failed.");
    const info = (await infoRes.json()) as {
      response?: { user?: VkUser };
    };
    const profile = info.response?.user;
    if (!profile) throw new Error("VK profile missing.");

    return {
      provider: "vk",
      providerAccountId: String(profile.user_id),
      username: profile.nickname ?? profile.first_name ?? null,
      displayName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || `VK ${profile.user_id}`,
      avatarUrl: profile.avatar ?? null,
      raw: profile as unknown as Record<string, unknown>,
    };
  },
};

interface VkUser {
  user_id: number;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  avatar?: string;
  phone?: string;
}

export const PROVIDERS: Record<ProviderKey, OAuthProvider> = {
  discord: discordProvider,
  vk: vkProvider,
};

export function isProviderKey(value: string): value is ProviderKey {
  return value === "discord" || value === "vk";
}
