import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

/* --------------------------- next/headers cookie jar --------------------------- */

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

import {
  SESSION_COOKIE,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken,
} from "@/server/auth/session";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

beforeEach(() => {
  jar.clear();
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars-long";
});

describe("session tokens", () => {
  it("round-trips userId and tokenVersion through the signed cookie", async () => {
    await setSessionCookie(42, 3);
    expect(jar.has(SESSION_COOKIE)).toBe(true);
    const session = await readSessionToken();
    expect(session).toEqual({ userId: 42, tokenVersion: 3 });
  });

  it("returns null without a cookie", async () => {
    expect(await readSessionToken()).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ tv: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("another-secret-another-secret"));
    jar.set(SESSION_COOKIE, forged);
    expect(await readSessionToken()).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    await setSessionCookie(42, 1);
    const token = jar.get(SESSION_COOKIE)!;
    const [header, , signature] = token.split(".");
    const payload = Buffer.from(
      JSON.stringify({ sub: "1", tv: 1, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString("base64url");
    jar.set(SESSION_COOKIE, `${header}.${payload}.${signature}`);
    expect(await readSessionToken()).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ tv: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret());
    jar.set(SESSION_COOKIE, expired);
    expect(await readSessionToken()).toBeNull();
  });

  it("rejects an alg other than HS256", async () => {
    const wrongAlg = await new SignJWT({ tv: 1 })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject("7")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret());
    jar.set(SESSION_COOKIE, wrongAlg);
    expect(await readSessionToken()).toBeNull();
  });

  it("returns null for garbage tokens instead of throwing", async () => {
    jar.set(SESSION_COOKIE, "not-a-jwt");
    expect(await readSessionToken()).toBeNull();
    jar.set(SESSION_COOKIE, "a.b.c");
    expect(await readSessionToken()).toBeNull();
  });

  it("clearSessionCookie removes the cookie", async () => {
    await setSessionCookie(1, 1);
    await clearSessionCookie();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await readSessionToken()).toBeNull();
  });

  it("fails loudly when AUTH_SECRET is missing or too short", async () => {
    process.env.AUTH_SECRET = "short";
    await expect(setSessionCookie(1, 1)).rejects.toThrow(/AUTH_SECRET/);
    delete process.env.AUTH_SECRET;
    await expect(setSessionCookie(1, 1)).rejects.toThrow(/AUTH_SECRET/);
  });
});
