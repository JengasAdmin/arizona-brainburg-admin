import "server-only";
import { createHash, randomBytes } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { integrationApiKeys, integrationEvents } from "@/db/schema";
import { errors } from "@/server/http";
import type { Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { getSetting } from "./settings";
import { countOf } from "./count";

export const INTEGRATION_STATUSES = {
  NOT_CONNECTED: "Not connected",
  CONNECTED: "Connected",
  DISABLED: "Disabled",
} as const;

/**
 * Integration status for the future game server / bot.
 * Nothing is faked: without provisioned API keys and the `integration_enabled`
 * setting the status is reported as “Not connected”.
 */
export async function getIntegrationStatus(): Promise<{
  status: string;
  enabled: boolean;
  activeKeys: number;
  eventsReceived: number;
  apiUrl: string | null;
  note: string;
}> {
  const enabled = (await getSetting<boolean>("integration_enabled")) ?? false;
  const activeKeys = await countOf(
    db,
    sql`SELECT count(*) AS count FROM integration_api_keys WHERE status = 'active'`,
  );
  const eventsReceived = await countOf(db, sql`SELECT count(*) AS count FROM integration_events`);
  const apiUrl = process.env.FUTURE_GAME_API_URL || null;

  const status = !enabled
    ? INTEGRATION_STATUSES.DISABLED
    : activeKeys > 0
      ? INTEGRATION_STATUSES.CONNECTED
      : INTEGRATION_STATUSES.NOT_CONNECTED;

  return {
    status,
    enabled,
    activeKeys,
    eventsReceived,
    apiUrl,
    note:
      status === INTEGRATION_STATUSES.CONNECTED
        ? "Integration API enabled with provisioned keys."
        : "Game API integration is not connected yet. Manual administration is used instead.",
  };
}

export const createKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(z.string().max(40)).min(1).max(10).default(["game:read", "activity:write"]),
});

export async function createIntegrationKey(
  input: z.infer<typeof createKeySchema>,
  actor: Actor,
  ip: string | null,
) {
  const plaintext = `abk_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  const keyPrefix = plaintext.slice(0, 12);

  const inserted = await db
    .insert(integrationApiKeys)
    .values({
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      status: "active",
      createdBy: actor.userId,
    })
    .returning({ id: integrationApiKeys.id });

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "CREATE_INTEGRATION_KEY",
    entityType: "integration_api_key",
    entityId: inserted[0]!.id,
    targetLabel: input.name,
    newValue: { name: input.name, scopes: input.scopes },
    ip,
  });

  // The plaintext key is returned exactly once — only its hash is stored.
  return { id: inserted[0]!.id, key: plaintext, name: input.name, scopes: input.scopes };
}

export async function listIntegrationKeys() {
  const rows = await db
    .select({
      id: integrationApiKeys.id,
      name: integrationApiKeys.name,
      keyPrefix: integrationApiKeys.keyPrefix,
      scopes: integrationApiKeys.scopes,
      status: integrationApiKeys.status,
      lastUsedAt: integrationApiKeys.lastUsedAt,
      createdAt: integrationApiKeys.createdAt,
    })
    .from(integrationApiKeys)
    .orderBy(desc(integrationApiKeys.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: `${r.keyPrefix}…`,
    scopes: r.scopes,
    status: r.status,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeIntegrationKey(id: number, actor: Actor, ip: string | null) {
  const rows = await db.select().from(integrationApiKeys).where(eq(integrationApiKeys.id, id));
  if (!rows[0]) throw errors.notFound("API key not found.");
  await db
    .update(integrationApiKeys)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(integrationApiKeys.id, id));
  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "REVOKE_INTEGRATION_KEY",
    entityType: "integration_api_key",
    entityId: id,
    targetLabel: rows[0].name,
    oldValue: "active",
    newValue: "disabled",
    ip,
  });
  return { id, status: "disabled" };
}

/** Bearer authentication for the future game bot. Returns the key id or null. */
export async function authenticateApiKey(authorization: string | null): Promise<number | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const rows = await db
    .select({ id: integrationApiKeys.id })
    .from(integrationApiKeys)
    .where(sql`${integrationApiKeys.keyHash} = ${hash} AND ${integrationApiKeys.status} = 'active'`)
    .limit(1);
  if (!rows[0]) return null;
  await db
    .update(integrationApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(integrationApiKeys.id, rows[0].id));
  return rows[0].id;
}

export async function recordIntegrationEvent(
  event: string,
  payload: Record<string, unknown>,
  apiKeyId: number | null,
  status: "received" | "processed" | "rejected" = "received",
) {
  const inserted = await db
    .insert(integrationEvents)
    .values({ event, payload, apiKeyId, status })
    .returning({ id: integrationEvents.id });
  return inserted[0]!.id;
}
