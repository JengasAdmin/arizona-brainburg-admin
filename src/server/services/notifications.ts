import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { NotificationType } from "@/lib/constants";

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType | string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export async function notify(input: CreateNotificationInput): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    metadata: input.metadata ?? null,
  });
}

/** Notify several users at once (e.g. all administrators). */
export async function notifyMany(userIds: number[], input: Omit<CreateNotificationInput, "userId">): Promise<void> {
  if (userIds.length === 0) return;
  await db.insert(notifications).values(
    userIds.map((userId) => ({ ...input, userId })),
  );
}

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(
  userId: number,
  opts: { unreadOnly?: boolean; page: number; pageSize: number },
): Promise<{ items: NotificationRow[]; total: number; unread: number; page: number; pageSize: number }> {
  const base = opts.unreadOnly ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : eq(notifications.userId, userId);

  const countRows = await db.$count(notifications, base);
  const total = countRows;

  const rows = await db
    .select()
    .from(notifications)
    .where(base)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    unread: await unreadCount(userId),
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export async function unreadCount(userId: number): Promise<number> {
  return db.$count(
    notifications,
    and(eq(notifications.userId, userId), isNull(notifications.readAt)),
  );
}

export async function markNotificationRead(userId: number, id: number): Promise<boolean> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  if (updated[0]) return true;
  // Already read (or not found) — verify ownership so we never leak existence.
  const owned = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return owned.length > 0;
}

export async function markAllNotificationsRead(userId: number): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return updated.length;
}
