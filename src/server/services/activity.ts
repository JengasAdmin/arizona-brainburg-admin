import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { factions, gameActivity, users } from "@/db/schema";
import { errors } from "@/server/http";
import type { Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { actorScope, departmentOfUser } from "./scope";
import { countOf } from "./count";

export const createActivitySchema = z.object({
  userId: z.coerce.number().int().positive(),
  action: z.string().trim().min(2).max(60),
  description: z.string().trim().min(3).max(500),
  occurredAt: z.coerce.date().optional(),
  factionId: z.coerce.number().int().positive().nullable().optional(),
});

export const activityQuerySchema = z.object({
  userId: z.coerce.number().int().optional(),
  factionId: z.coerce.number().int().optional(),
  action: z.string().max(60).optional(),
  source: z.enum(["manual", "integration"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export interface ActivityItem {
  id: number;
  userId: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  factionId: number | null;
  factionName: string | null;
  action: string;
  description: string;
  source: string;
  occurredAt: string;
  createdBy: string | null;
}

export async function listActivity(query: z.infer<typeof activityQuerySchema>, actor: Actor) {
  const scope = actorScope(actor);
  const conditions = [sql`TRUE`];
  if (scope !== null) {
    conditions.push(sql`(f.department_id IS NULL OR f.department_id = ANY(${scope}))`);
  }
  if (query.userId) conditions.push(sql`ga.user_id = ${query.userId}`);
  if (query.factionId) conditions.push(sql`ga.faction_id = ${query.factionId}`);
  if (query.action) conditions.push(sql`ga.action = ${query.action}`);
  if (query.source) conditions.push(sql`ga.source = ${query.source}`);
  const where = sql.join(conditions, sql` AND `);

  const total = await countOf(
    db,
    sql`SELECT count(*) AS count FROM game_activity ga
        LEFT JOIN factions f ON f.id = ga.faction_id
        WHERE ${where}`,
  );

  const res = await db.execute(sql`
    SELECT ga.id, ga.user_id, u.display_name, u.nickname, u.avatar_url,
           ga.faction_id, f.name AS faction_name, ga.action, ga.description,
           ga.source, ga.occurred_at, cu.display_name AS created_by_name
    FROM game_activity ga
    JOIN users u ON u.id = ga.user_id
    LEFT JOIN factions f ON f.id = ga.faction_id
    LEFT JOIN users cu ON cu.id = ga.created_by
    WHERE ${where}
    ORDER BY ga.occurred_at DESC, ga.id DESC
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
  `);

  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];

  return {
    items: rows.map(
      (r): ActivityItem => ({
        id: r.id as number,
        userId: r.user_id as number,
        displayName: r.display_name as string,
        nickname: (r.nickname as string | null) ?? null,
        avatarUrl: (r.avatar_url as string | null) ?? null,
        factionId: (r.faction_id as number | null) ?? null,
        factionName: (r.faction_name as string | null) ?? null,
        action: r.action as string,
        description: r.description as string,
        source: r.source as string,
        occurredAt: new Date(r.occurred_at as string).toISOString(),
        createdBy: (r.created_by_name as string | null) ?? null,
      }),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Manual game activity — used until the real game API is connected. */
export async function createActivity(
  input: z.infer<typeof createActivitySchema>,
  actor: Actor,
  ip: string | null,
) {
  const userRows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!userRows[0]) throw errors.notFound("Пользователь не найден.");

  const departmentId = input.factionId
    ? ((await db
        .select({ departmentId: factions.departmentId })
        .from(factions)
        .where(eq(factions.id, input.factionId)
        ).then((r) => r[0]?.departmentId ?? null)) ?? (await departmentOfUser(input.userId)))
    : await departmentOfUser(input.userId);

  const inserted = await db
    .insert(gameActivity)
    .values({
      userId: input.userId,
      factionId: input.factionId ?? null,
      action: input.action,
      description: input.description,
      occurredAt: input.occurredAt ?? new Date(),
      source: "manual",
      createdBy: actor.userId,
    })
    .returning();

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "CREATE_GAME_ACTIVITY",
    entityType: "game_activity",
    entityId: inserted[0]!.id,
    targetLabel: `${userRows[0].displayName} — ${input.action}`,
    newValue: { action: input.action, description: input.description },
    ip,
    departmentId,
  });

  return { activityId: inserted[0]!.id };
}
