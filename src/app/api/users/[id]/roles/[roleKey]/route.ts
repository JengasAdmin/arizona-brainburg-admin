import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { removeRole } from "@/server/services/users";

/** DELETE /api/users/:id/roles/:roleKey */
export const DELETE = guard(
  {
    method: "DELETE",
    auth: true,
    permission: "MANAGE_ROLES",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ params, auth, req }) => {
    const result = await removeRole(Number(params.id), params.roleKey, auth.actor, getClientIp(req));
    return NextResponse.json(result);
  },
);
