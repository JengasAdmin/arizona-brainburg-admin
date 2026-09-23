import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  budgetAccounts,
  factionCategories,
  factionPositions,
  factions,
} from "@/db/schema";
import { errors } from "@/server/http";
import type { Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { actorScope } from "./scope";
import { countRows } from "./count";

export interface FactionListItem {
  id: number;
  key: string;
  name: string;
  shortName: string;
  description: string | null;
  categoryKey: string;
  categoryName: string;
  departmentId: number;
  departmentKey: string;
  status: string;
  allowMultipleLeaders: boolean;
  allowCrossFactionLeadership: boolean;
  members: number;
  activeLeaders: number;
  activeDeputies: number;
  budget: number;
  createdAt: string;
}

export async function listFactions(actor: Actor): Promise<FactionListItem[]> {
  const scope = actorScope(actor);
  const scopeCond = scope === null ? sql`TRUE` : sql`f.department_id = ANY(${scope})`;

  const res = await db.execute(sql`
    SELECT f.id, f.key, f.name, f.short_name, f.description, f.status,
           f.allow_multiple_leaders, f.allow_cross_faction_leadership, f.created_at,
           fc.key AS category_key, fc.name AS category_name,
           d.key AS department_key, f.department_id,
           (SELECT count(*)::int FROM leadership_terms lt WHERE lt.faction_id = f.id AND lt.status = 'active') AS members,
           (SELECT count(*)::int FROM leadership_terms lt
              JOIN faction_positions fp ON fp.id = lt.position_id
             WHERE lt.faction_id = f.id AND lt.status = 'active' AND fp.kind = 'leader') AS active_leaders,
           (SELECT count(*)::int FROM leadership_terms lt
              JOIN faction_positions fp ON fp.id = lt.position_id
             WHERE lt.faction_id = f.id AND lt.status = 'active' AND fp.kind = 'deputy') AS active_deputies,
           COALESCE((SELECT ba.balance FROM budget_accounts ba WHERE ba.faction_id = f.id), 0) AS budget
    FROM factions f
    JOIN faction_categories fc ON fc.id = f.category_id
    JOIN departments d ON d.id = f.department_id
    WHERE ${scopeCond}
    ORDER BY fc.sort_order, f.name
  `);

  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    id: r.id as number,
    key: r.key as string,
    name: r.name as string,
    shortName: r.short_name as string,
    description: (r.description as string | null) ?? null,
    categoryKey: r.category_key as string,
    categoryName: r.category_name as string,
    departmentId: r.department_id as number,
    departmentKey: r.department_key as string,
    status: r.status as string,
    allowMultipleLeaders: Boolean(r.allow_multiple_leaders),
    allowCrossFactionLeadership: Boolean(r.allow_cross_faction_leadership),
    members: r.members as number,
    activeLeaders: r.active_leaders as number,
    activeDeputies: r.active_deputies as number,
    budget: r.budget as number,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function getFactionDetail(factionId: number, actor: Actor) {
  const list = await listFactions(actor);
  const faction = list.find((f) => f.id === factionId);
  if (!faction) throw errors.notFound("Faction not found.");

  const positions = await db
    .select()
    .from(factionPositions)
    .where(eq(factionPositions.factionId, factionId))
    .orderBy(asc(factionPositions.sortOrder));

  const activeCounts = await Promise.all(
    positions.map((p) =>
      countRows(
        sql`SELECT count(*) AS count FROM leadership_terms
            WHERE position_id = ${p.id} AND status = 'active'`,
      ),
    ),
  );

  return {
    ...faction,
    positions: positions.map((p, index) => ({
      id: p.id,
      key: p.key,
      title: p.title,
      kind: p.kind,
      sortOrder: p.sortOrder,
      maxActiveTerms: p.maxActiveTerms,
      status: p.status,
      description: p.description,
      activeTerms: activeCounts[index] ?? 0,
    })),
  };
}

/* ---------------------------------- Create --------------------------------- */

export const createFactionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric/underscore."),
  name: z.string().trim().min(2).max(80),
  shortName: z.string().trim().min(2).max(12),
  description: z.string().trim().max(600).nullable().optional(),
  categoryId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive(),
  allowMultipleLeaders: z.boolean().default(false),
  allowCrossFactionLeadership: z.boolean().default(false),
  leaderTitle: z.string().trim().min(2).max(80).optional(),
  deputyTitle: z.string().trim().min(2).max(80).optional(),
});

export const updateFactionSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  shortName: z.string().trim().min(2).max(12).optional(),
  description: z.string().trim().max(600).nullable().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  allowMultipleLeaders: z.boolean().optional(),
  allowCrossFactionLeadership: z.boolean().optional(),
});

export async function createFaction(
  input: z.infer<typeof createFactionSchema>,
  actor: Actor,
  ip: string | null,
) {
  const category = await db.select().from(factionCategories).where(eq(factionCategories.id, input.categoryId));
  if (!category[0]) throw errors.notFound("Faction category not found.");

  let factionId: number;
  try {
    const inserted = await db
      .insert(factions)
      .values({
        key: input.key,
        name: input.name,
        shortName: input.shortName,
        description: input.description ?? null,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        allowMultipleLeaders: input.allowMultipleLeaders,
        allowCrossFactionLeadership: input.allowCrossFactionLeadership,
      })
      .returning({ id: factions.id });
    factionId = inserted[0]!.id;
  } catch {
    throw errors.conflict("A faction with this key already exists.", "FACTION_KEY_EXISTS");
  }

  // Budget account is created together with the faction — balance starts at 0.
  await db.insert(budgetAccounts).values({ factionId, balance: 0 });

  // Optional default positions.
  const positionValues = [];
  if (input.leaderTitle) {
    positionValues.push({
      factionId,
      key: `${input.key}_leader`,
      title: input.leaderTitle,
      kind: "leader",
      sortOrder: 0,
    });
  }
  if (input.deputyTitle) {
    positionValues.push({
      factionId,
      key: `${input.key}_deputy`,
      title: input.deputyTitle,
      kind: "deputy",
      sortOrder: 1,
    });
  }
  if (positionValues.length > 0) await db.insert(factionPositions).values(positionValues);

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "CREATE_FACTION",
    entityType: "faction",
    entityId: factionId,
    targetLabel: input.name,
    oldValue: null,
    newValue: input,
    ip,
    departmentId: input.departmentId,
  });

  return { factionId };
}

export async function updateFaction(
  factionId: number,
  input: z.infer<typeof updateFactionSchema>,
  actor: Actor,
  ip: string | null,
) {
  const before = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
  if (!before[0]) throw errors.notFound("Faction not found.");

  const updated = await db
    .update(factions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(factions.id, factionId))
    .returning();

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "UPDATE_FACTION",
    entityType: "faction",
    entityId: factionId,
    targetLabel: before[0].name,
    oldValue: before[0],
    newValue: input,
    ip,
    departmentId: before[0].departmentId,
  });

  return updated[0];
}

export async function deleteFaction(factionId: number, actor: Actor, ip: string | null) {
  const before = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
  if (!before[0]) throw errors.notFound("Faction not found.");

  const activeTerms = await countRows(
    sql`SELECT count(*) AS count FROM leadership_terms WHERE faction_id = ${factionId} AND status = 'active'`,
  );
  if (activeTerms > 0) {
    throw errors.conflict(
      "Dismiss all active leaders/deputies before deleting this faction.",
      "FACTION_HAS_ACTIVE_TERMS",
    );
  }
  const hasTransactions = await countRows(
    sql`SELECT count(*) AS count FROM budget_transactions WHERE faction_id = ${factionId}`,
  );
  if (hasTransactions > 0) {
    throw errors.conflict(
      "Faction has budget history and cannot be deleted (set it inactive instead).",
      "FACTION_HAS_BUDGET_HISTORY",
    );
  }

  await db.delete(factions).where(eq(factions.id, factionId));

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "DELETE_FACTION",
    entityType: "faction",
    entityId: factionId,
    targetLabel: before[0].name,
    oldValue: before[0],
    newValue: null,
    ip,
    departmentId: before[0].departmentId,
  });

  return { factionId };
}

/* -------------------------------- Positions -------------------------------- */

export const createPositionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric/underscore."),
  title: z.string().trim().min(2).max(80),
  kind: z.enum(["leader", "deputy"]),
  maxActiveTerms: z.coerce.number().int().min(1).max(10).default(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  description: z.string().trim().max(300).nullable().optional(),
});

export const updatePositionSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  kind: z.enum(["leader", "deputy"]).optional(),
  maxActiveTerms: z.coerce.number().int().min(1).max(10).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  description: z.string().trim().max(300).nullable().optional(),
});

export async function createPosition(
  factionId: number,
  input: z.infer<typeof createPositionSchema>,
  actor: Actor,
  ip: string | null,
) {
  const faction = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
  if (!faction[0]) throw errors.notFound("Faction not found.");

  let positionId: number;
  try {
    const inserted = await db
      .insert(factionPositions)
      .values({ factionId, ...input })
      .returning({ id: factionPositions.id });
    positionId = inserted[0]!.id;
  } catch {
    throw errors.conflict("A position with this key already exists in the faction.", "POSITION_KEY_EXISTS");
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "CREATE_POSITION",
    entityType: "faction_position",
    entityId: positionId,
    targetLabel: `${input.title} (${faction[0].name})`,
    newValue: input,
    ip,
    departmentId: faction[0].departmentId,
  });

  return { positionId };
}

export async function updatePosition(
  positionId: number,
  input: z.infer<typeof updatePositionSchema>,
  actor: Actor,
  ip: string | null,
) {
  const before = await db
    .select({ position: factionPositions, faction: factions })
    .from(factionPositions)
    .innerJoin(factions, eq(factions.id, factionPositions.factionId))
    .where(eq(factionPositions.id, positionId))
    .limit(1);
  if (!before[0]) throw errors.notFound("Position not found.");

  // Renaming a position never rewrites history — old terms keep their own snapshot.
  await db
    .update(factionPositions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(factionPositions.id, positionId));

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "UPDATE_POSITION",
    entityType: "faction_position",
    entityId: positionId,
    targetLabel: `${before[0].position.title} (${before[0].faction.name})`,
    oldValue: before[0].position,
    newValue: input,
    ip,
    departmentId: before[0].faction.departmentId,
  });

  return { positionId };
}
