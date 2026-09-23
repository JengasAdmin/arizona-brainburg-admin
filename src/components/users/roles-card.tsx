import { listDepartments } from "@/server/services/roles-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/utils";
import { KeyRound } from "lucide-react";
import { RoleAssignDialog, type AssignableRole } from "./role-assign-dialog";
import { RoleRowActions } from "./role-row-actions";

export interface ProfileRole {
  key: string;
  name: string;
  category: string;
  departmentId: number | null;
  assignedAt: string;
}

/**
 * Server component: renders the assigned roles of a user and embeds the client
 * dialogs (assign / revoke) when the actor holds MANAGE_ROLES.
 */
export async function RolesCard({
  userId,
  roles,
  canAssign,
  assignableRoles,
}: {
  userId: number;
  roles: ProfileRole[];
  canAssign: boolean;
  assignableRoles: AssignableRole[];
}) {
  const departments = await listDepartments();
  const scopeOf = (departmentId: number | null): string => {
    if (departmentId == null) return "Global";
    return departments.find((d) => d.id === departmentId)?.name ?? "Scoped";
  };
  const availableCount = assignableRoles.filter(
    (role) => !roles.some((assigned) => assigned.key === role.key),
  ).length;

  return (
    <Card>
      <CardHeader
        title="Assigned roles"
        description="Roles currently granted to this account."
        actions={
          canAssign && availableCount > 0 ? (
            <RoleAssignDialog
              userId={userId}
              roles={assignableRoles}
              assignedKeys={roles.map((role) => role.key)}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
                >
                  Assign role
                </button>
              }
            />
          ) : null
        }
      />
      {roles.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-8 w-8" />}
          title="No roles assigned"
          description="This account only has its default access."
        />
      ) : (
        <ul className="divide-y divide-line/70">
          {roles.map((role) => (
            <li
              key={role.key}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-neutral-200">{role.name}</span>
                  <Badge tone={role.category === "administration" ? "info" : "neutral"}>
                    {scopeOf(role.departmentId)}
                  </Badge>
                  <Badge tone="neutral">{role.category}</Badge>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-600">
                  Assigned {formatDateTime(role.assignedAt)} · Granted by —
                </div>
              </div>
              {canAssign ? (
                <RoleRowActions userId={userId} roleKey={role.key} roleTitle={role.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
