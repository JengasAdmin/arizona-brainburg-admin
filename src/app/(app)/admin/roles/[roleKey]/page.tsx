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
  administration: "Администрирование",
  supervision: "Надзор",
  player: "Игрок",
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

  const scopeLabel = departmentName ? `Ведомство · ${departmentName}` : "Глобально";

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
            <ArrowLeft className="h-3.5 w-3.5" /> Все роли
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <code className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
          {role.key}
        </code>
        <Badge tone={role.level >= 80 ? "info" : "neutral"}>Уровень {role.level}</Badge>
        <Badge tone={departmentName ? "neutral" : "info"}>{scopeLabel}</Badge>
        <Badge>{CATEGORY_LABEL[role.category] ?? role.category}</Badge>
        {founderProtected ? <Badge tone="warn">неизменяемая</Badge> : null}
        <Badge tone={assign.allowed ? "ok" : "danger"}>
          <span title={assign.allowed ? undefined : (assign.reason ?? "FORBIDDEN")}>
            {assign.allowed ? "Доступна для назначения" : "Недоступна для назначения"}
          </span>
        </Badge>
      </div>

      <Card>
        <CardHeader title="Правила иерархии" description="Статические сведения об этой роли и вашем доступе к ней." />
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Уровень</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.level} — никогда не может управлять или назначать что-либо выше собственного
                уровня.
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Область действия</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {departmentName
                  ? `Ведомство — выдаёт свои разрешения только внутри ${departmentName}.`
                  : "Глобально — выдаёт свои разрешения во всех ведомствах."}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Участники</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.memberCount.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Разрешения</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {role.permissions.length} действующих
                {catalog
                  ? ` · ${base.length} базовых в каталоге`
                  : " · пользовательская роль (базы в каталоге нет)"}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Категория</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {CATEGORY_LABEL[role.category] ?? role.category}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-neutral-500">Назначение (ваша учётная запись)</dt>
              <dd className="mt-0.5 text-[13px] text-neutral-200">
                {assign.allowed
                  ? "Вы можете назначать и редактировать эту роль."
                  : `Запрещено движком RBAC${assign.reason ? ` (${assign.reason})` : ""}.`}
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
                    Набор разрешений Founder неизменяем — эта роль доступна только для чтения.
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Сервер отклоняет любое изменение с кодом FOUNDER_ROLE_PROTECTED, поэтому
                    редактор разрешений заменён этим сообщением.
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
