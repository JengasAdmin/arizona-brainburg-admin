import { NextResponse } from "next/server";
import { z } from "zod";
import { errors, errorResponse, getClientIp, parseJsonBody } from "@/server/http";
import { authenticateApiKey, recordIntegrationEvent } from "@/server/services/integration";
import { getSetting } from "@/server/services/settings";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

const schema = z.object({
  event: z.string().trim().min(2).max(60),
  payload: z.record(z.unknown()).default({}),
});

/**
 * POST /api/integration/game/events — entry point for the future game bot.
 * Auth: `Authorization: Bearer <integration api key>` (no user session).
 * Disabled until `integration_enabled` is set and a key is provisioned → 503.
 */
export async function POST(req: Request) {
  try {
    const enabled = (await getSetting<boolean>("integration_enabled")) ?? false;
    if (!enabled) {
      throw errors.serviceUnavailable(
        "Integration status: Not connected. Enable the integration in Settings → Integration.",
        "INTEGRATION_DISABLED",
      );
    }

    const limit = rateLimit(
      `integration:${getClientIp(req as never)}`,
      RATE_LIMITS.integration.limit,
      RATE_LIMITS.integration.windowMs,
    );
    if (!limit.ok) throw errors.rateLimited(limit.retryAfterSec);

    const apiKeyId = await authenticateApiKey(req.headers.get("authorization"));
    if (!apiKeyId) throw errors.forbidden("Invalid or disabled API key.", "INVALID_API_KEY");

    const body = await parseJsonBody(req as never, schema);
    const eventId = await recordIntegrationEvent(body.event, body.payload, apiKeyId, "received");
    return NextResponse.json({ ok: true, eventId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
