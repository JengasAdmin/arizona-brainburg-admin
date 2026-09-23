import type { NextRequest } from "next/server";
import { errors, errorResponse, getClientIp } from "@/server/http";
import { beginOAuth } from "@/server/auth/oauth/flow";
import { isProviderKey } from "@/server/auth/oauth/providers";
import { randomToken } from "@/server/auth/oauth/providers";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

/**
 * GET /api/auth/:provider — start the OAuth flow (Discord / VK).
 * Query: ?mode=login|link&redirectTo=/path
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    if (!isProviderKey(provider)) throw errors.notFound("Неизвестный OAuth-провайдер.");

    const limit = rateLimit(
      `auth-start:${getClientIp(req)}`,
      RATE_LIMITS.oauthStart.limit,
      RATE_LIMITS.oauthStart.windowMs,
    );
    if (!limit.ok) throw errors.rateLimited(limit.retryAfterSec);

    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode = modeParam === "link" ? "link" : "login";
    const redirectTo = req.nextUrl.searchParams.get("redirectTo");
    const codeVerifier = provider === "discord" ? randomToken(32) : undefined;

    return beginOAuth({
      provider,
      mode,
      redirectTo,
      codeVerifier,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
