import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requirePageAuth } from "@/server/page-auth";
import { listRolesWithPermissions, listDepartments } from "@/server/services/roles-admin";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermissionEditor } from "@/components/admin/permission-editor";
import { RoleAudit } from "@/components/admin/role-audit";
import { can, canAssignRole, canGrantPermission, isFounder } from "@/lib/rbac/engine";
import { PERMISSION_KEYS } from "@/lib/rbac/permissions";
import {
  DEPARTMENTS,
  FOUNDER_ROLE_KEY,
  ROLE_MAP,
  type RoleDefinition,
} from "@/lib/rbac/roles";

export const dynamic = "force-dynamic";

function catalogRole(key: string): RoleDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(ROLE_MAP, key) ? ROLE_MAP[key] : undefined;
}

const CATEGORY_LABEL: Record<string, string> = {
  administration: "Administration",
  supervision: "Supervision",
  player: "Player",
};

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleKey: string }>;
}) {
  const auth = await requirePageAuth("MANAGE_ROLES");
  const { roleKey } = await params;

  const [roles, dbDepartments] = await Promise.all([
    listRolesWithPermissions(),
    listDepartments(),
  ]);
  const role = roles.find((r) => r.key === roleKey);
  if (!role) notFound();

  const catalog = catalogRole(role.key);
  const base: string[] = catalog ? [...catalog.permissions] : [];
  const description = catalog?.description || role.description || "—";

  const deptNameByKey = new Map<string, string>(
    dbDepartments.map((d) => [d.key, d.name]),
  );
  for (const catalogDept of DEPARTMENTS) {
    if (!deptNameByKey.has(catalogDept.key)) deptNameByKey.set(catalogDept.key, catalogDept.name);
  }
  const departmentName = role.departmentKey
    ? deptNameByKey.get(role.departmentKey) ?? role.departmentKey
    : null;

  const founderActor = isFounder(auth.actor);
  const assign = canAssignRole(auth.actor, {
    key: role.key,
    level: role.level,
    category: role.category,
  });
  const grantable: string[] = PERMISSION_KEYS.filter(
    (k) => canGrantPermission(auth.actor, k).allowed,
  );
  const founderProtected = role.key === FOUNDER_ROLE_KEY;
  const canResetGrants =
    catalog !== undefined &&
    !founderProtected &&
    assign.allowed &&
    base.every((k) => canGrantPermission(auth.actor, k).allowed);
  const canViewAudit = can(auth.actor, "VIEW_AUDIT_LOGS").allowed;

  const scopeLabel = departmentName ? `Department · ${departmentName}` : "Global";

  return (
    <div>
      <PageHeader
        title={role.name}
        description={description}
        actions={
          <Link
            href="/admin/roles"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-neutral-300 transition-colors hover:border-line2 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All roles
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <code className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
          {role.key}
        </code>
        <Badge tone={role.level >= 80 ? "info" : "neutral"}>Level {role.level}</Badge>
        <Badge tone={departmentName ? "neutral" : "info"}>{scopeLabel}</Badge>
        <Badge>{CATEGORY_LABEL[role.category] ?? role.category}</Badge>
        {founderProtected ? <Badge tone="warn">immutable</Badge> : null}
        <Badge tone={assign.allowed ? "ok" : "danger"}>
          <span title={assign.allowed ? undefined : (assign.reason ?? "FORBIDDEN")}>
            {assign.allowed ? "Assignable by you" : "Not assignable by you"}
          </span>
        </Badge>
      </div>

      <Card>
        <CardHeader title="Hierarchy rules" description="Static facts about this role and your access to it." />
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Level</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.level} — may never manage or assign anything above its own level.
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Scope</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {departmentName
                  ? `Department — grants its permissions only inside ${departmentName}.`
                  : "Global — grants its permissions in every department."}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Members</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.memberCount.toLocaleString("en-US")} user{role.memberCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Permissions</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.permissions.length} current
                {catalog ? ` · ${base.length} catalog base` : " · custom role (no catalog base)"}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Category</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {CATEGORY_LABEL[role.category] ?? role.category}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Assignment (your account)</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {assign.allowed
                  ? "You may assign and edit this role."
                  : `Denied by the RBAC engine${assign.reason ? ` (${assign.reason})` : ""}.`}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="mt-4">
        {founderProtected ? (
          <Card>
            <CardBody>
              <div className="flex items-start gap-3 rounded-md border border-line bg-panel px-4 py-3.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                <div>
                  <p className="text-[13px] text-neutral-200">
                    The Founder permission set is immutable — this role is read-only.
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    The server rejects any edit with FOUNDER_ROLE_PROTECTED, so the permission
                    editor is replaced by this banner.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <PermissionEditor
            roleKey={role.key}
            roleName={role.name}
            initialGrants={role.permissions}
            basePermissions={base}
            grantable={grantable}
            canAssign={assign.allowed}
            isFounder={founderActor}
            canResetGrants={canResetGrants}
          />
        )}
      </div>

      {canViewAudit ? (
        <div className="mt-4">
          <RoleAudit roleKey={role.key} />
        </div>
      ) : null}
    </div>
  );
}
