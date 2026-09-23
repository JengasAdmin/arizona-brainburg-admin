import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  disciplinaryActions,
  factionPositions,
  factions,
  leadershipPointsHistory,
  leadershipTerms,
  users,
} from "@/db/schema";
import { errors } from "@/server/http";
import type { Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { notify } from "./notifications";
import { actorScope } from "./scope";
import { getSetting } from "./settings";
import { countOf } from "./count";

/* ---------------------------------- Types ---------------------------------- */

export interface TermListItem {
  id: number;
  termNumber: number;
  userId: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  factionId: number;
  factionName: string;
  factionShort: string;
  departmentId: number;
  positionId: number;
  positionTitle: string;
  positionKind: string;
  rank: number;
  status: string;
  appointedAt: string;
  appointmentReason: string;
  appointedBy: string | null;
  dismissedAt: string | null;
  dismissalReason: string | null;
  dismissedBy: string | null;
  leadershipPoints: number;
  warningsCount: number;
  reprimandsCount: number;
}

export const termQuerySchema = z.object({
  factionId: z.coerce.number().int().optional(),
  positionId: z.coerce.number().int().optional(),
  userId: z.coerce.number().int().optional(),
  status: z.enum(["active", "dismissed"]).optional(),
  kind: z.enum(["leader", "deputy"]).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type TermQuery = z.infer<typeof termQuerySchema>;

const SELECT_TERMS = sql`
  SELECT lt.id, lt.term_number, lt.user_id, u.display_name, u.nickname, u.avatar_url,
         lt.faction_id, f.name AS faction_name, f.short_name, f.department_id,
         lt.position_id, fp.title AS position_title, fp.kind AS position_kind,
         lt.rank, lt.status, lt.appointed_at, lt.appointment_reason,
         au.display_name AS appointed_by_name,
         lt.dismissed_at, lt.dismissal_reason, du.display_name AS dismissed_by_name,
         lt.leadership_points, lt.warnings_count, lt.reprimands_count
  FROM leadership_terms lt
  JOIN users u ON u.id = lt.user_id
  JOIN factions f ON f.id = lt.faction_id
  JOIN faction_positions fp ON fp.id = lt.position_id
  LEFT JOIN users au ON au.id = lt.appointed_by
  LEFT JOIN users du ON du.id = lt.dismissed_by
`;

function mapTerm(r: Record<string, unknown>): TermListItem {
  return {
    id: r.id as number,
    termNumber: r.term_number as number,
    userId: r.user_id as number,
    displayName: r.display_name as string,
    nickname: (r.nickname as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    factionId: r.faction_id as number,
    factionName: r.faction_name as string,
    factionShort: r.short_name as string,
    departmentId: r.department_id as number,
    positionId: r.position_id as number,
    positionTitle: r.position_title as string,
    positionKind: r.position_kind as string,
    rank: r.rank as number,
    status: r.status as string,
    appointedAt: new Date(r.appointed_at as string).toISOString(),
    appointmentReason: r.appointment_reason as string,
    appointedBy: (r.appointed_by_name as string | null) ?? null,
    dismissedAt: r.dismissed_at ? new Date(r.dismissed_at as string).toISOString() : null,
    dismissalReason: (r.dismissal_reason as string | null) ?? null,
    dismissedBy: (r.dismissed_by_name as string | null) ?? null,
    leadershipPoints: r.leadership_points as number,
    warningsCount: r.warnings_count as number,
    reprimandsCount: r.reprimands_count as number,
  };
}

/* ---------------------------------- List ----------------------------------- */

export async function listTerms(query: TermQuery, actor: Actor) {
  const scope = actorScope(actor);
  const conditions = [sql`TRUE`];
  if (scope !== null) conditions.push(sql`f.department_id = ANY(${scope})`);
  if (query.factionId) conditions.push(sql`lt.faction_id = ${query.factionId}`);
  if (query.positionId) conditions.push(sql`lt.position_id = ${query.positionId}`);
  if (query.userId) conditions.push(sql`lt.user_id = ${query.userId}`);
  if (query.status) conditions.push(sql`lt.status = ${query.status}`);
  if (query.kind) conditions.push(sql`fp.kind = ${query.kind}`);
  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(sql`(u.display_name ILIKE ${like} OR u.nickname ILIKE ${like} OR u.id::text = ${query.q})`);
  }
  const where = sql.join(conditions, sql` AND `);

  const countRes = await db.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count
        FROM leadership_terms lt
        JOIN users u ON u.id = lt.user_id
        JOIN factions f ON f.id = lt.faction_id
        JOIN faction_positions fp ON fp.id = lt.position_id
        WHERE ${where}`,
  );
  const total = Number(
    ((countRes as unknown as { rows?: { count: string }[] }).rows?.[0]?.count as string) ?? "0",
  );

  const offset = (query.page - 1) * query.pageSize;
  const res = await db.execute(
    sql`${SELECT_TERMS} WHERE ${where} ORDER BY lt.status = 'active' DESC, lt.appointed_at DESC, lt.id DESC LIMIT ${query.pageSize} OFFSET ${offset}`,
  );
  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];

  return { items: rows.map(mapTerm), total, page: query.page, pageSize: query.pageSize };
}

export async function getTerm(termId: number) {
  const res = await db.execute(sql`${SELECT_TERMS} WHERE lt.id = ${termId} LIMIT 1`);
  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];
  if (!rows[0]) throw errors.notFound("Term not found.");
  return mapTerm(rows[0]);
}

/* -------------------------------- Appoint --------------------------------- */

/** Strict calendar date: YYYY-MM-DD with a real month/day (rejects 2026-13-45). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    if (m < 1 || m > 12 || d < 1) return false;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d <= daysInMonth;
  }, "Date must be a real calendar date.");

export const appointSchema = z.object({
  userId: z.coerce.number().int().positive(),
  positionId: z.coerce.number().int().positive(),
  rank: z.coerce.number().int().min(1).max(999).default(1),
  rankLabel: z.string().trim().max(80).nullable().optional(),
  appointedAt: isoDate.optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function appointTerm(
  input: z.infer<typeof appointSchema>,
  actor: Actor,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const positionRows = await tx
      .select()
      .from(factionPositions)
      .where(eq(factionPositions.id, input.positionId))
      .for("update");
    const position = positionRows[0];
    if (!position || position.status !== "active") throw errors.notFound("Position not found.");

    const factionRows = await tx.select().from(factions).where(eq(factions.id, position.factionId));
    const faction = factionRows[0];
    if (!faction) throw errors.notFound("Faction not found.");

    const userRows = await tx.select().from(users).where(eq(users.id, input.userId));
    const target = userRows[0];
    if (!target) throw errors.notFound("User not found.");
    if (target.status !== "active") {
      throw errors.conflict(`User account is ${target.status}.`, "USER_NOT_ACTIVE");
    }

    // Rule 1 — a position may only hold `maxActiveTerms` active terms at once.
    const activeForPosition = await countOf(
      tx,
      sql`SELECT count(*) AS count FROM leadership_terms
          WHERE position_id = ${position.id} AND status = 'active'`,
    );
    if (activeForPosition >= position.maxActiveTerms) {
      throw errors.conflict(
        `Position “${position.title}” already has ${activeForPosition} active term(s) (max ${position.maxActiveTerms}).`,
        "POSITION_ALREADY_FILLED",
      );
    }

    // Rule 2 — factions with a single leader may not get a second active leader term.
    if (position.kind === "leader" && !faction.allowMultipleLeaders) {
      const activeLeaders = await tx.execute(sql`
        SELECT count(*)::int AS count FROM leadership_terms lt
        JOIN faction_positions fp ON fp.id = lt.position_id
        WHERE lt.faction_id = ${faction.id} AND lt.status = 'active' AND fp.kind = 'leader'
      `);
      const count =
        ((activeLeaders as unknown as { rows?: { count: number }[] }).rows?.[0]?.count as number) ?? 0;
      if (count >= 1) {
        throw errors.conflict(
          `${faction.name} already has an active leader.`,
          "FACTION_ALREADY_HAS_LEADER",
        );
      }
    }

    // Rule 3 — one user may not lead two factions simultaneously unless allowed.
    if (position.kind === "leader") {
      const allowMulti = await getSetting<boolean>("allow_multiple_active_terms");
      if (!faction.allowCrossFactionLeadership && !allowMulti) {
        const otherLeaders = await tx.execute(sql`
          SELECT count(*)::int AS count FROM leadership_terms lt
          JOIN faction_positions fp ON fp.id = lt.position_id
          WHERE lt.user_id = ${target.id} AND lt.status = 'active' AND fp.kind = 'leader'
            AND lt.faction_id <> ${faction.id}
        `);
        const count =
          ((otherLeaders as unknown as { rows?: { count: number }[] }).rows?.[0]?.count as number) ?? 0;
        if (count >= 1) {
          throw errors.conflict(
            `${target.displayName} already holds an active leadership term in another faction.`,
            "USER_ALREADY_LEADER_ELSEWHERE",
          );
        }
      }
    }

    const numberRows = await tx.execute(sql`
      SELECT COALESCE(MAX(term_number), 0) + 1 AS next FROM leadership_terms
      WHERE position_id = ${position.id}
    `);
    const termNumber =
      ((numberRows as unknown as { rows?: { next: number }[] }).rows?.[0]?.next as number) ?? 1;

    const inserted = await tx
      .insert(leadershipTerms)
      .values({
        termNumber,
        userId: target.id,
        factionId: faction.id,
        positionId: position.id,
        rank: input.rank,
        rankLabel: input.rankLabel ?? null,
        appointedAt: input.appointedAt ?? new Date().toISOString().slice(0, 10),
        appointmentReason: input.reason,
        appointedBy: actor.userId,
        status: "active",
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();

    const term = inserted[0]!;

    await writeAudit({
      actorId: actor.userId,
      actorRole: actor.roles[0]?.name ?? null,
      action: position.kind === "deputy" ? "APPOINT_DEPUTY" : "APPOINT_LEADER",
      entityType: "leadership_term",
      entityId: term.id,
      targetLabel: `${target.displayName} — ${position.title}`,
      oldValue: null,
      newValue: {
        status: "active",
        position: position.title,
        faction: faction.name,
        rank: input.rank,
        termNumber,
      },
      reason: input.reason,
      ip,
      departmentId: faction.departmentId,
    });

    return { termId: term.id, termNumber };
  });
}

/* -------------------------------- Dismiss --------------------------------- */

export const dismissSchema = z.object({
  dismissedAt: isoDate.optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function dismissTerm(
  termId: number,
  input: z.infer<typeof dismissSchema>,
  actor: Actor,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        term: leadershipTerms,
        positionTitle: factionPositions.title,
        positionKind: factionPositions.kind,
        factionName: factions.name,
        departmentId: factions.departmentId,
        displayName: users.displayName,
      })
      .from(leadershipTerms)
      .innerJoin(factionPositions, eq(factionPositions.id, leadershipTerms.positionId))
      .innerJoin(factions, eq(factions.id, leadershipTerms.factionId))
      .innerJoin(users, eq(users.id, leadershipTerms.userId))
      .where(eq(leadershipTerms.id, termId))
      .for("update");

    const row = rows[0];
    if (!row) throw errors.notFound("Term not found.");
    if (row.term.status !== "active") {
      throw errors.conflict("This term is already closed.", "TERM_ALREADY_CLOSED");
    }

    const updated = await tx
      .update(leadershipTerms)
      .set({
        status: "dismissed",
        dismissedAt: input.dismissedAt ?? new Date().toISOString().slice(0, 10),
        dismissalReason: input.reason,
        dismissedBy: actor.userId,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(leadershipTerms.id, termId))
      .returning();

    await writeAudit({
      actorId: actor.userId,
      actorRole: actor.roles[0]?.name ?? null,
      action: row.positionKind === "deputy" ? "DISMISS_DEPUTY" : "DISMISS_LEADER",
      entityType: "leadership_term",
      entityId: termId,
      targetLabel: `${row.displayName} — ${row.positionTitle}`,
      oldValue: "active",
      newValue: "dismissed",
      reason: input.reason,
      ip,
      departmentId: row.departmentId,
    });

    await notify({
      userId: row.term.userId,
      type: row.positionKind === "deputy" ? "leader_dismissed" : "leader_dismissed",
      title: row.positionKind === "deputy" ? "Deputy dismissed" : "Leader dismissed",
      body: `You have been dismissed from “${row.positionTitle}”. Reason: ${input.reason}`,
      link: `/users/${row.term.userId}`,
      metadata: { termId },
    });

    return { termId, status: updated[0]?.status ?? "dismissed" };
  });
}

/* --------------------------------- Points --------------------------------- */

export const pointsSchema = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, "Delta cannot be zero."),
  reason: z.string().trim().min(3).max(500),
});

export async function adjustPoints(
  termId: number,
  input: z.infer<typeof pointsSchema>,
  actor: Actor,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        term: leadershipTerms,
        positionTitle: factionPositions.title,
        displayName: users.displayName,
        departmentId: factions.departmentId,
      })
      .from(leadershipTerms)
      .innerJoin(factionPositions, eq(factionPositions.id, leadershipTerms.positionId))
      .innerJoin(factions, eq(factions.id, leadershipTerms.factionId))
      .innerJoin(users, eq(users.id, leadershipTerms.userId))
      .where(eq(leadershipTerms.id, termId))
      .for("update");

    const row = rows[0];
    if (!row) throw errors.notFound("Term not found.");
    if (row.term.status !== "active") {
      throw errors.conflict("Points can only be changed on an active term.", "TERM_NOT_ACTIVE");
    }

    const oldValue = row.term.leadershipPoints;
    const newValue = oldValue + input.delta;
    if (newValue < 0) {
      throw errors.validation([{ path: "delta", message: "Leadership points cannot become negative." }]);
    }

    await tx
      .update(leadershipTerms)
      .set({ leadershipPoints: newValue, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(leadershipTerms.id, termId));

    await tx.insert(leadershipPointsHistory).values({
      termId,
      oldValue,
      newValue,
      difference: input.delta,
      reason: input.reason,
      actorId: actor.userId,
    });

    await writeAudit({
      actorId: actor.userId,
      actorRole: actor.roles[0]?.name ?? null,
      action: input.delta > 0 ? "ADD_LEADERSHIP_POINTS" : "REMOVE_LEADERSHIP_POINTS",
      entityType: "leadership_term",
      entityId: termId,
      targetLabel: `${row.displayName} — ${row.positionTitle}`,
      oldValue,
      newValue,
      reason: input.reason,
      ip,
      departmentId: row.departmentId,
    });

    await notify({
      userId: row.term.userId,
      type: "points_changed",
      title: `Leadership points ${input.delta > 0 ? "added" : "removed"}`,
      body: `${input.delta > 0 ? "+" : ""}${input.delta} points on “${row.positionTitle}”. Reason: ${input.reason}`,
      link: `/users/${row.term.userId}`,
      metadata: { termId, oldValue, newValue },
    });

    return { termId, oldValue, newValue, difference: input.delta };
  });
}

/* ------------------------------- Disciplinary ------------------------------ */

export const disciplinarySchema = z.object({
  type: z.enum(["warning", "reprimand"]),
  reason: z.string().trim().min(3).max(500),
});

export async function addDisciplinary(
  termId: number,
  input: z.infer<typeof disciplinarySchema>,
  actor: Actor,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        term: leadershipTerms,
        positionTitle: factionPositions.title,
        displayName: users.displayName,
        departmentId: factions.departmentId,
      })
      .from(leadershipTerms)
      .innerJoin(factionPositions, eq(factionPositions.id, leadershipTerms.positionId))
      .innerJoin(factions, eq(factions.id, leadershipTerms.factionId))
      .innerJoin(users, eq(users.id, leadershipTerms.userId))
      .where(eq(leadershipTerms.id, termId))
      .for("update");

    const row = rows[0];
    if (!row) throw errors.notFound("Term not found.");
    if (row.term.status !== "active") {
      throw errors.conflict("Disciplinary actions require an active term.", "TERM_NOT_ACTIVE");
    }

    const inserted = await tx
      .insert(disciplinaryActions)
      .values({
        type: input.type,
        termId,
        userId: row.term.userId,
        reason: input.reason,
        issuedBy: actor.userId,
      })
      .returning();

    const isWarning = input.type === "warning";
    await tx
      .update(leadershipTerms)
      .set(
        isWarning
          ? {
              warningsCount: row.term.warningsCount + 1,
              updatedBy: actor.userId,
              updatedAt: new Date(),
            }
          : {
              reprimandsCount: row.term.reprimandsCount + 1,
              updatedBy: actor.userId,
              updatedAt: new Date(),
            },
      )
      .where(eq(leadershipTerms.id, termId));

    await writeAudit({
      actorId: actor.userId,
      actorRole: actor.roles[0]?.name ?? null,
      action: isWarning ? "GIVE_WARNING" : "GIVE_REPRIMAND",
      entityType: "disciplinary_action",
      entityId: inserted[0]!.id,
      targetLabel: `${row.displayName} — ${row.positionTitle}`,
      oldValue: null,
      newValue: { type: input.type, reason: input.reason, termId },
      reason: input.reason,
      ip,
      departmentId: row.departmentId,
    });

    await notify({
      userId: row.term.userId,
      type: isWarning ? "warning_received" : "reprimand_received",
      title: isWarning ? "Warning received" : "Reprimand received",
      body: `${isWarning ? "Warning" : "Reprimand"} issued on “${row.positionTitle}”. Reason: ${input.reason}`,
      link: `/users/${row.term.userId}`,
      metadata: { termId },
    });

    return { id: inserted[0]!.id, type: input.type };
  });
}

/* --------------------------------- History -------------------------------- */

export async function getTermHistory(termId: number) {
  const [points, disciplinary] = await Promise.all([
    db
      .select()
      .from(leadershipPointsHistory)
      .where(eq(leadershipPointsHistory.termId, termId))
      .orderBy(desc(leadershipPointsHistory.createdAt)),
    db
      .select({
        id: disciplinaryActions.id,
        type: disciplinaryActions.type,
        reason: disciplinaryActions.reason,
        issuedAt: disciplinaryActions.issuedAt,
        issuedBy: users.displayName,
      })
      .from(disciplinaryActions)
      .leftJoin(users, eq(users.id, disciplinaryActions.issuedBy))
      .where(eq(disciplinaryActions.termId, termId))
      .orderBy(desc(disciplinaryActions.issuedAt)),
  ]);
  return { points, disciplinary };
}

export async function updateTermRank(
  termId: number,
  input: { rank: number; rankLabel?: string | null },
  actor: Actor,
  ip: string | null,
) {
  const before = await getTerm(termId);
  if (before.status !== "active") {
    throw errors.conflict("Historical terms cannot be edited.", "TERM_CLOSED");
  }
  const updated = await db
    .update(leadershipTerms)
    .set({
      rank: input.rank,
      rankLabel: input.rankLabel ?? null,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(leadershipTerms.id, termId))
    .returning();
  if (!updated[0]) throw errors.notFound("Term not found.");

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "EDIT_LEADER",
    entityType: "leadership_term",
    entityId: termId,
    targetLabel: `${before.displayName} — ${before.positionTitle}`,
    oldValue: { rank: before.rank },
    newValue: { rank: input.rank },
    ip,
    departmentId: before.departmentId,
  });

  return updated[0];
}
