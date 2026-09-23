import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { guard } from "@/server/guard";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSessionCookie } from "@/server/auth/session";
import { getClientIp } from "@/server/http";
import { writeAudit } from "@/server/services/audit";

/**
 * POST /api/auth/logout-all — revoke EVERY session of the current user by
 * bumping its token version (all previously issued JWTs become invalid).
 */
export const POST = guard(
  { method: "POST", auth: true, rateLimit: { limit: 5, windowMs: 60_000 } },
  async ({ auth, req }) => {
    const updated = await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, auth.user.id))
      .returning({ tokenVersion: users.tokenVersion });

    await writeAudit({
      actorId: auth.user.id,
      actorRole: auth.actor.roles[0]?.name ?? null,
      action: "REVOKE_ALL_SESSIONS",
      entityType: "session",
      entityId: auth.user.id,
      targetLabel: auth.user.displayName,
      ip: getClientIp(req),
    });

    await clearSessionCookie();
    return NextResponse.json({ ok: true, tokenVersion: updated[0]?.tokenVersion ?? null });
  },
);
