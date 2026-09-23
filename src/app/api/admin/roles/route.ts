import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import {
  createCustomRole,
  createRoleSchema,
  listRolesWithPermissions,
} from "@/server/services/roles-admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DEPARTMENTS } from "@/lib/rbac/roles";

/** GET /api/admin/roles — role catalog with permissions and member counts. */
export const GET = guard(
  { method: "GET", auth: true, permission: "MANAGE_ROLES", rateLimit: RATE_LIMITS.read },
  async () => {
    const items = await listRolesWithPermissions();
    return NextResponse.json({
      items,
      permissionCatalog: PERMISSIONS,
      departments: DEPARTMENTS,
    });
  },
);

/** POST /api/admin/roles — create a custom role inside the hierarchy. */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "MANAGE_ROLES",
    schema: createRoleSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ body, auth, req }) => {
    const fwd = req.headers.get("x-forwarded-for");
    const result = await createCustomRole(body, auth.actor, fwd?.split(",")[0]?.trim() ?? null);
    return NextResponse.json(result, { status: 201 });
  },
);
