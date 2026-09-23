import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { guard } from "@/server/guard";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { DEFAULT_USER_PREFERENCES } from "@/lib/settings-catalog";

const patchSchema = z.object({
  preferences: z.record(z.union([z.boolean(), z.string(), z.number()])),
});

async function load(userId: number): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return { ...DEFAULT_USER_PREFERENCES, ...(rows[0]?.preferences ?? {}) };
}

/** GET /api/me/preferences — own preferences (defaults merged in). */
export const GET = guard({ method: "GET", auth: true }, async ({ auth }) => {
  return NextResponse.json({ preferences: await load(auth.user.id) });
});

/** PATCH /api/me/preferences — merge updated preferences for the current user. */
export const PATCH = guard(
  {
    method: "PATCH",
    auth: true,
    schema: patchSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ auth, body }) => {
    const current = await load(auth.user.id);
    const merged = { ...current, ...body.preferences };
    await db
      .insert(userPreferences)
      .values({ userId: auth.user.id, preferences: merged, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { preferences: merged, updatedAt: new Date() },
      });
    return NextResponse.json({ preferences: merged });
  },
);
