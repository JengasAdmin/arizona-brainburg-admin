import { NextResponse } from "next/server";
import { guard, errors } from "@/server/guard";
import { updateRolePermissionSet, updateRolePermissionsSchema } from "@/server/services/roles-admin";

/** PUT /api/admin/roles/:roleKey/permissions - replace a role's permission set. */
export const PUT = guard(
  {
    method: "PUT",
    auth: true,
    permission: "MANAGE_PERMISSIONS",
    schema: updateRolePermissionsSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ params, body, auth, req }) => {
    if (!params.roleKey) throw errors.notFound("Роль не найдена.");
    const fwd = req.headers.get("x-forwarded-for");
    const result = await updateRolePermissionSet(
      params.roleKey,
      body,
      auth.actor,
      fwd?.split(",")[0]?.trim() ?? null,
    );
    return NextResponse.json(result);
  },
);
