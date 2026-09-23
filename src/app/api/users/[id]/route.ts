import { NextResponse } from "next/server";
import { guard, errors } from "@/server/guard";
import { can } from "@/lib/rbac/engine";
import { getUserDetail } from "@/server/services/users";
import { RATE_LIMITS } from "@/server/security/rate-limit";

/** GET /api/users/:id — own profile is always readable; others require VIEW_PROFILES. */
export const GET = guard(
  { method: "GET", auth: true, rateLimit: RATE_LIMITS.read },
  async ({ params, auth }) => {
    const userId = Number(params.id);
    if (userId !== auth.user.id) {
      const decision = can(auth.actor, "VIEW_PROFILES");
      if (!decision.allowed) {
        throw errors.forbidden("Нет разрешения: VIEW_PROFILES.", decision.reason ?? "FORBIDDEN");
      }
    }
    const detail = await getUserDetail(userId, auth.actor);
    return NextResponse.json(detail);
  },
);
