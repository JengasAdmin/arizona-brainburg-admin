import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { errors, errorResponse, getClientIp } from "@/server/http";
import { db } from "@/db";
import { authenticateApiKey } from "@/server/services/integration";
import { getSetting } from "@/server/services/settings";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

/**
 * GET /api/integration/game/players — roster for the future game bot.
 * Returns Game ID, nickname, faction, rank. `online` is null until the real
 * game API is connected (nothing is faked).
 */
export async function GET(req: Request) {
  try {
    const enabled = (await getSetting<boolean>("integration_enabled")) ?? false;
    if (!enabled) {
      throw errors.serviceUnavailable(
        "Integration status: Not connected.",
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

    const res = await db.execute(sql`
      SELECT u.id, u.game_id, u.nickname, u.display_name, u.status,
             f.short_name AS faction_name, lt.rank
      FROM users u
      LEFT JOIN LATERAL (
        SELECT lt.faction_id, lt.rank
        FROM leadership_terms lt
        WHERE lt.user_id = u.id AND lt.status = 'active'
        ORDER BY lt.appointed_at DESC LIMIT 1
      ) latest ON true
      LEFT JOIN factions f ON f.id = latest.faction_id
      WHERE u.game_id IS NOT NULL
      ORDER BY u.id
      LIMIT 500
    `);

    const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
      string,
      unknown
    >[];

    return NextResponse.json({
      serverId: 5,
      players: rows.map((r) => ({
        userId: r.id as number,
        gameId: r.game_id as string,
        nickname: (r.nickname as string | null) ?? null,
        displayName: r.display_name as string,
        faction: (r.faction_name as string | null) ?? null,
        rank: (r.rank as number | null) ?? null,
        online: null, // requires the live game API — intentionally not simulated
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
