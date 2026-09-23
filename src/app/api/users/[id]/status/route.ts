import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { departmentOfUser } from "@/server/services/scope";
import { setUserStatus } from "@/server/services/users";

const schema = z.object({
  status: z.enum(["active", "suspended", "blocked", "inactive"]),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/users/:id/status — block / unblock / suspend a user. */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "BLOCK_USERS",
    schema,
    scope: async ({ params }) => ({ departmentId: await departmentOfUser(Number(params.id)) }),
  },
  async ({ params, body, auth, req }) => {
    const updated = await setUserStatus(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json({ user: { id: updated.id, status: updated.status } });
  },
);
