import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { errors } from "@/server/http";
import { DEFAULT_SETTINGS } from "@/lib/settings-catalog";

export { DEFAULT_SETTINGS };

export async function ensureSettingsSeeded(): Promise<void> {
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    if (!existing[0]) {
      await db.insert(systemSettings).values({
        key,
        value: def.value,
        description: def.description,
      });
    } else if (existing[0].description !== def.description) {
      // Описание — служебное: синхронизируем с каталогом, не трогая value.
      await db
        .update(systemSettings)
        .set({ description: def.description })
        .where(eq(systemSettings.key, key));
    }
  }
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (!rows[0]) return null;
  return rows[0].value as T;
}

export async function getAllSettings() {
  await ensureSettingsSeeded();
  return db.select().from(systemSettings);
}

export const updateSettingSchema = z.object({
  value: z.unknown(),
});

export async function updateSetting(key: string, value: unknown, actorId: number) {
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (!existing[0]) throw errors.notFound(`Неизвестная настройка: ${key}`);
  await db
    .update(systemSettings)
    .set({ value, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(systemSettings.key, key));
  return { key, value, previousValue: existing[0].value };
}
