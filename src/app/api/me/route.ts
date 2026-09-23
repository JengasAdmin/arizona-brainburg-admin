import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { errors } from "@/server/http";
import { updateProfile } from "@/server/services/users";
import { getClientIp } from "@/server/http";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { summarizePermissions } from "@/lib/rbac/engine";
import { listTerms } from "@/server/services/leadership";
import { unreadCount } from "@/server/services/notifications";

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(64).optional(),
  nickname: z.string().trim().max(64).nullable().optional(),
  branch: z.string().trim().max(120).nullable().optional(),
  gameId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z_-]{1,32}$/, "Game ID must be 1-32 alphanumeric characters.")
    .nullable()
    .optional(),
});

/** GET /api/me — own profile, roles, effective permissions and open terms. */
export const GET = guard(
  {
    method: "GET",
    auth: true,
    rateLimit: { limit: 300, windowMs: 60_000 },
  },
  async ({ auth }) => {
    const rows = await db.select().from(users).where(eq(users.id, auth.user.id)).limit(1);
    const user = rows[0];
    if (!user) throw errors.notFound("User not found.");

    const terms = await listTerms({ userId: user.id, page: 1, pageSize: 50 }, auth.actor);

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        gameId: user.gameId,
        gameIdVerifiedAt: user.gameIdVerifiedAt?.toISOString() ?? null,
        serverNumber: auth.user.serverNumber,
        status: user.status,
        branch: user.branch,
        registrationSource: user.registrationSource,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      roles: auth.actor.roles.map((r) => ({
        key: r.key,
        name: r.name,
        level: r.level,
        category: r.category,
        departmentId: r.departmentId,
      })),
      permissions: summarizePermissions(auth.actor),
      providers: auth.connectedProviders,
      terms: terms.items,
      unreadNotifications: await unreadCount(user.id),
    });
  },
);

/** PATCH /api/me — edit own profile (Game ID changes always reset verification). */
export const PATCH = guard(
  { method: "PATCH", auth: true, schema: patchSchema, rateLimit: { limit: 20, windowMs: 60_000 } },
  async ({ body, auth, req }) => {
    const updated = await updateProfile(auth.user.id, body, auth.actor, getClientIp(req));
    return NextResponse.json({ user: { id: updated.id, nickname: updated.nickname } });
  },
);
