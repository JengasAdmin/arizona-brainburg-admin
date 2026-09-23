import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { errors } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { listNotifications, markAllNotificationsRead } from "@/server/services/notifications";

/** GET /api/notifications?unreadOnly=&page= — always scoped to the current user. */
export const GET = guard(
  { method: "GET", auth: true, rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") ?? "25") || 25, 100);
    if (page < 1) throw errors.validation([{ path: "page", message: "Invalid page." }]);
    return NextResponse.json(await listNotifications(auth.user.id, { unreadOnly, page, pageSize }));
  },
);

/** POST /api/notifications/read-all — mark every notification as read. */
export const POST = guard(
  { method: "POST", auth: true, rateLimit: { limit: 30, windowMs: 60_000 } },
  async ({ auth }) => {
    const updated = await markAllNotificationsRead(auth.user.id);
    return NextResponse.json({ updated });
  },
);
