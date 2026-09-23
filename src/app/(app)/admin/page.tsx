import Link from "next/link";
import { requirePageAuth } from "@/server/page-auth";
import { listRolesWithPermissions } from "@/server/services/roles-admin";
import { listAudit } from "@/server/services/audit";
import { actorScope } from "@/server/services/scope";
import { PageHeader, StatCard } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/rbac/engine";
import { DEPARTMENTS, ROLE_DEFINITIONS, ROLE_MAP, type RoleDefinition } from "@/lib/rbac/roles";
import { formatDateTime } from "@/lib/utils";
import { formatAuditSentence } from "@/lib/audit-format";
import { ArrowRight, FileClock, ScrollText, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

function catalogRole(key: string): RoleDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(ROLE_MAP, key) ? ROLE_MAP[key] : undefined;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

export default async function AdministrationPage() {
  const auth = await requirePageAuth("MANAGE_ROLES");
  const roles = await listRolesWithPermissions();

  // Catalog-derived facts (static role/department catalog — not fabricated stats).
  const totalRoles = roles.length;
  const customPermissionSets = roles.filter((role) => {
    const base = catalogRole(role.key)?.permissions;
    if (!base) return true; // custom-created role — no catalog base to compare against
    return !sameSet(role.permissions, base);
  }).length;
  const departmentCount = DEPARTMENTS.length;
  const adminTierCount = ROLE_DEFINITIONS.filter(
    (r) => r.key === "administrator_level_4" || r.key === "administrator_level_3",
  ).length;

  // Recent role changes — the audit service supports an `entityType` filter.
  const canViewAudit = can(auth.actor, "VIEW_AUDIT_LOGS").allowed;
  const roleAudit = canViewAudit
    ? await listAudit({ entityType: "role", page: 1, pageSize: 10 }, actorScope(auth.actor))
    : null;

  return (
    <div>
      <PageHeader
        title="Администрирование"
        description="Роли, выдача разрешений и управление системой"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Всего ролей"
          value={totalRoles.toLocaleString("en-US")}
          hint="Роли из каталога и пользовательские"
          href="/admin/roles"
        />
        <StatCard
          label="Пользовательские наборы разрешений"
          value={customPermissionSets.toLocaleString("en-US")}
          hint="Вычисляется: сохранённый набор отличается от базового в каталоге"
          href="/admin/roles"
        />
        <StatCard
          label="Ведомства"
          value={departmentCount.toLocaleString("en-US")}
          hint="Направления надзора из каталога"
        />
        <StatCard
          label="Роли админ-уровня (L3/L4)"
          value={adminTierCount.toLocaleString("en-US")}
          hint="Из каталога: Administrator Level 3–4"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Link
          href="/admin/roles"
          className="group rounded-lg border border-line bg-card p-4 transition-colors hover:border-line2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileClock className="h-4 w-4 text-neutral-500" /> Роли и разрешения
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Просмотр иерархии, редактирование наборов разрешений и сброс пользовательских
                выдач.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600 transition-colors group-hover:text-white" />
          </div>
        </Link>
        <Link
          href="/settings"
          className="group rounded-lg border border-line bg-card p-4 transition-colors hover:border-line2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Settings2 className="h-4 w-4 text-neutral-500" /> Интеграция и системные настройки
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Ключи API интеграции и глобальные настройки находятся в разделе «Настройки».
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600 transition-colors group-hover:text-white" />
          </div>
        </Link>
      </div>

      {roleAudit ? (
        <div className="mt-5">
          <Card>
            <CardHeader
              title="Недавние изменения ролей"
              description="Последние действия аудита для сущностей роли (entityType = role)."
            />
            {roleAudit.items.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="h-8 w-8" />}
                title="Изменения ролей ещё не записаны"
                description="Создание ролей и изменение разрешений появятся здесь по мере выполнения."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[560px]">
                  <THead>
                    <TR>
                      <TH>Действие</TH>
                      <TH>Запись</TH>
                      <TH>Причина</TH>
                      <TH align="right">Дата</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {roleAudit.items.map((row) => (
                      <TR key={row.id}>
                        <TD>
                          <Badge tone="neutral">{row.action}</Badge>
                        </TD>
                        <TD className="max-w-[320px]">
                          <div className="truncate text-neutral-300" title={formatAuditSentence(row)}>
                            {formatAuditSentence(row)}
                          </div>
                        </TD>
                        <TD className="max-w-[180px] truncate text-neutral-500">{row.reason ?? "—"}</TD>
                        <TD align="right" className="whitespace-nowrap text-neutral-500">
                          {formatDateTime(row.createdAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
