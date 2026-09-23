import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";
import { getAuth } from "@/server/auth/access";
import { writeAudit } from "@/server/services/audit";
import { errorResponse, errors, getClientIp } from "@/server/http";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

/** POST /api/auth/logout */
export async function POST(req: Request) {
  try {
    const limit = rateLimit(
      `auth-logout:${getClientIp(req as never)}`,
      RATE_LIMITS.authSensitive.limit,
      RATE_LIMITS.authSensitive.windowMs,
    );
    if (!limit.ok) throw errors.rateLimited(limit.retryAfterSec);

    return await handleLogout(req);
  } catch (err) {
    return errorResponse(err);
  }
}

async function handleLogout(req: Request) {
  const auth = await getAuth();
  if (auth) {
    await writeAudit({
      actorId: auth.user.id,
      actorRole: auth.actor.roles[0]?.name ?? null,
      action: "LOGOUT",
      entityType: "session",
      entityId: auth.user.id,
      targetLabel: auth.user.displayName,
      ip: req instanceof Request && "headers" in req ? getClientIp(req as never) : null,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
