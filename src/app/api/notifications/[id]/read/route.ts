import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { markNotificationRead } from "@/server/services/notifications";

/** POST /api/notifications/:id/read — mark a single notification as read. */
export const POST = guard(
  { method: "POST", auth: true, rateLimit: { limit: 120, windowMs: 60_000 } },
  async ({ params, auth }) => {
    const ok = await markNotificationRead(auth.user.id, Number(params.id));
    return NextResponse.json({ ok });
  },
);
