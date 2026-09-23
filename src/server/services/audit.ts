import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { errors } from "@/server/http";

export interface AuditInput {
  actorId?: number | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  targetLabel?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
  /** Department used for scoped audit visibility (specialized supervisors). */
  departmentId?: number | null;
}

/**
 * Append-only audit entry. The row is NEVER updated or deleted afterwards —
 * immutability is additionally enforced by a PostgreSQL trigger.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const storeIp = await ipCollectionEnabled();
    await db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : null,
      targetLabel: input.targetLabel ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      reason: input.reason ?? null,
      ip: storeIp ? input.ip ?? null : null,
      departmentId: input.departmentId ?? null,
    });
  } catch (err) {
    // Audit failures must never silently pass for critical actions.
    console.error("[audit] write failed", err);
    throw errors.internal();
  }
}

let ipFlagCache: { value: boolean; at: number } | null = null;
async function ipCollectionEnabled(): Promise<boolean> {
  if (ipFlagCache && Date.now() - ipFlagCache.at < 30_000) return ipFlagCache.value;
  const rows = await db.execute<{ value: boolean }>(
    sql`SELECT (value #>> '{}')::boolean AS value FROM system_settings WHERE key = 'audit_store_ip'`,
  );
  const row = (rows as unknown as { rows?: { value: boolean | null }[] }).rows?.[0];
  const value = row?.value ?? true;
  ipFlagCache = { value, at: Date.now() };
  return value;
}

export const auditQuerySchema = z.object({
  action: z.string().max(100).optional(),
  entityType: z.string().max(50).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  targetLabel: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditListResult {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditRow {
  id: number;
  actorId: number | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  targetLabel: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  ip: string | null;
  departmentId: number | null;
  createdAt: string;
}

export async function listAudit(query: AuditQuery, departmentIds: number[] | null): Promise<AuditListResult> {
  const conditions = [sql`TRUE`];
  if (departmentIds !== null) {
    conditions.push(sql`a.department_id = ANY(${departmentIds})`);
  }
  if (query.action) conditions.push(sql`a.action = ${query.action}`);
  if (query.entityType) conditions.push(sql`a.entity_type = ${query.entityType}`);
  if (query.actorId) conditions.push(sql`a.actor_id = ${query.actorId}`);
  if (query.targetLabel) conditions.push(sql`a.target_label ILIKE ${`%${query.targetLabel}%`}`);

  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count FROM audit_logs a WHERE ${where}`,
  );
  const total = Number(
    (countRows as unknown as { rows?: { count: string }[] }).rows?.[0]?.count ?? "0",
  );

  const offset = (query.page - 1) * query.pageSize;
  const rows = await db.execute<{
    id: number;
    actor_id: number | null;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    target_label: string | null;
    old_value: unknown;
    new_value: unknown;
    reason: string | null;
    ip: string | null;
    department_id: number | null;
    created_at: Date;
  }>(sql`
    SELECT a.id, a.actor_id, u.display_name AS actor_name, a.actor_role, a.action,
           a.entity_type, a.entity_id, a.target_label, a.old_value, a.new_value,
           a.reason, a.ip, a.department_id, a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${query.pageSize} OFFSET ${offset}
  `);

  const list = (rows as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  return {
    items: list.map((r) => ({
      id: r.id as number,
      actorId: (r.actor_id as number | null) ?? null,
      actorName: (r.actor_name as string | null) ?? null,
      actorRole: (r.actor_role as string | null) ?? null,
      action: r.action as string,
      entityType: r.entity_type as string,
      entityId: (r.entity_id as string | null) ?? null,
      targetLabel: (r.target_label as string | null) ?? null,
      oldValue: r.old_value ?? null,
      newValue: r.new_value ?? null,
      reason: (r.reason as string | null) ?? null,
      ip: (r.ip as string | null) ?? null,
      departmentId: (r.department_id as number | null) ?? null,
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
