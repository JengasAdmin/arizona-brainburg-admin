import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { updateSetting } from "@/server/services/settings";
import { writeAudit } from "@/server/services/audit";

const schema = z.object({ value: z.unknown() });

/** PATCH /api/settings/:key — change a system setting (audited). */
export const PATCH = guard(
  {
    method: "PATCH",
    auth: true,
    permission: "SYSTEM_SETTINGS",
    schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ params, body, auth, req }) => {
    const result = await updateSetting(params.key, body.value, auth.user.id);
    await writeAudit({
      actorId: auth.user.id,
      actorRole: auth.actor.roles[0]?.name ?? null,
      action: "UPDATE_SETTING",
      entityType: "system_setting",
      entityId: params.key,
      targetLabel: params.key,
      oldValue: result.previousValue,
      newValue: result.value,
      ip: getClientIp(req),
    });
    return NextResponse.json({ key: result.key, value: result.value });
  },
);
