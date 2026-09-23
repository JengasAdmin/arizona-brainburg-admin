import { requirePageAuth } from "@/server/page-auth";
import type { AuthContext } from "@/server/auth/access";
import { listUsers } from "@/server/services/users";
import { listDepartments, listRolesWithPermissions } from "@/server/services/roles-admin";
import { canAssignRole, canManageAdminUsers, isFounder } from "@/lib/rbac/engine";
import { isPermissionKey } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { UsersTable } from "@/components/users/users-table";
import type { AssignableRole } from "@/components/users/role-assign-dialog";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["active", "suspended", "blocked", "inactive"] as const;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
  { value: "inactive", label: "Inactive" },
];

/** Roles this actor may actually grant (level + hierarchy + permissions checked server-side). */
async function computeAssignableRoles(auth: AuthContext): Promise<AssignableRole[]> {
  const [allRoles, departments] = await Promise.all([listRolesWithPermissions(), listDepartments()]);
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
  const founder = isFounder(auth.actor);
  const canManageAdmins = canManageAdminUsers(auth.actor).allowed;

  return allRoles
    .filter((role) => canAssignRole(auth.actor, role).allowed)
    .filter((role) => role.category !== "administration" || canManageAdmins)
    .filter((role) =>
      founder || role.permissions.every((p) => isPermissionKey(p) && auth.permissions.has(p)),
    )
    .map((role) => ({
      key: role.key,
      title: role.name,
      scope:
        role.departmentId == null
          ? "Global"
          : (departmentNames.get(role.departmentId) ?? "Scoped"),
    }));
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; unverifiedGameId?: string }>;
}) {
  const auth = await requirePageAuth("VIEW_USERS");
  const sp = await searchParams;

  const canViewRecords = auth.permissions.has("VIEW_PROFILES");
  if (!canViewRecords) {
    return (
      <div>
        <PageHeader title="Users" description="Registered members of Server #5" />
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="You do not have permission to view user records."
            description="Ask an administrator to grant you the View profiles permission."
          />
        </Card>
      </div>
    );
  }

  const q = (sp.q ?? "").trim().slice(0, 120);
  const status = STATUS_VALUES.includes((sp.status ?? "") as (typeof STATUS_VALUES)[number])
    ? (sp.status as (typeof STATUS_VALUES)[number])
    : undefined;
  const parsedPage = Number.parseInt(sp.page ?? "", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;

  const result = await listUsers(
    {
      q: q || undefined,
      status,
      page,
      pageSize: 25,
      // Also keeps the dashboard's “unverified Game ID” shortcut working.
      unverifiedGameId: sp.unverifiedGameId === "true" || sp.unverifiedGameId === "1",
    },
    auth.actor,
  );

  const canEditStatus = auth.permissions.has("BLOCK_USERS");
  const canEditGameId = auth.permissions.has("EDIT_PROFILES");
  const canAssignRoles = auth.permissions.has("MANAGE_ROLES");
  const canViewAudit = auth.permissions.has("VIEW_AUDIT_LOGS");
  const assignableRoles = canAssignRoles ? await computeAssignableRoles(auth) : [];

  return (
    <div>
      <PageHeader title="Users" description="Registered members of Server #5" />
      <UsersTable
        rows={result.items}
        pagination={{
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        }}
        filters={{ q: q || undefined, status }}
        statuses={STATUS_OPTIONS}
        canEditStatus={canEditStatus}
        canEditGameId={canEditGameId}
        canAssignRoles={canAssignRoles}
        canViewAudit={canViewAudit}
        assignableRoles={assignableRoles}
      />
    </div>
  );
}
