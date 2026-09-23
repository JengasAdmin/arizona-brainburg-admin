import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { assignRole } from "@/server/services/users";

const schema = z.object({ roleKey: z.string().trim().min(1).max(80) });

/**
 * POST /api/users/:id/roles — assign a role.
 * Hierarchy rules are enforced server-side (level + permission grant checks).
 */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "MANAGE_ROLES",
    schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ params, body, auth, req }) => {
    const result = await assignRole(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json(result);
  },
);
