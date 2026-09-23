import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { getAllSettings } from "@/server/services/settings";

/** GET /api/settings — system settings (administrators only). */
export const GET = guard(
  { method: "GET", auth: true, permission: "SYSTEM_SETTINGS", rateLimit: RATE_LIMITS.read },
  async () => {
    const rows = await getAllSettings();
    return NextResponse.json({
      items: rows.map((r) => ({
        key: r.key,
        value: r.value,
        description: r.description,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  },
);
