import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth/access";
import { summarizePermissions } from "@/lib/rbac/engine";
import { unreadCount } from "@/server/services/notifications";

/** GET /api/auth/session — lightweight session probe for the client. */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: auth.user.id,
      displayName: auth.user.displayName,
      nickname: auth.user.nickname,
      avatarUrl: auth.user.avatarUrl,
      status: auth.user.status,
      serverNumber: auth.user.serverNumber,
    },
    roles: auth.actor.roles.map((r) => ({ key: r.key, name: r.name, level: r.level })),
    permissions: summarizePermissions(auth.actor),
    unreadNotifications: await unreadCount(auth.user.id),
  });
}
