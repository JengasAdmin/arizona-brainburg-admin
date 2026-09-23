import Link from "next/link";
import { ChevronLeft, ChevronRight, FileClock } from "lucide-react";
import { requirePageAuth } from "@/server/page-auth";
import { listAudit, type AuditQuery } from "@/server/services/audit";
import { actorScope } from "@/server/services/scope";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { AuditToolbar, type AuditFilters } from "@/components/audit/audit-toolbar";
import { AuditExpandRow } from "@/components/audit/audit-expand-row";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Entity types with a verified in-app route. Only `user` resolves to a known
 * page (/users/:id — see user-menu + notification links); faction/budget ids
 * have no verifiable key-based route yet, so no link is rendered for them.
 */
function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "user" && /^\d+$/.test(entityId)) return `/users/${entityId}`;
  return null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const auth = await requirePageAuth("VIEW_AUDIT_LOGS");
  const sp = await searchParams;

  const filters: AuditFilters = {
    q: first(sp.q),
    action: first(sp.action),
    entityType: first(sp.entityType),
    actor: first(sp.actor),
  };
  const actorId = /^\d+$/.test(filters.actor) ? Number(filters.actor) : undefined;
  const rawPage = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const query: AuditQuery = {
    page,
    pageSize: PAGE_SIZE,
    ...(filters.q ? { targetLabel: filters.q } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(actorId ? { actorId } : {}),
  };

  const result = await listAudit(query, actorScope(auth.actor));

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const from = (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.actor) params.set("actor", filters.actor);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/audit${qs ? `?${qs}` : ""}`;
  };

  const hasFilters = Boolean(
    filters.q || filters.action || filters.entityType || filters.actor,
  );

  return (
    <div>
      <PageHeader
        title="Журнал аудита"
        description="Неизменяемая запись всех привилегированных действий"
      />

      <AuditToolbar filters={filters} />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<FileClock className="h-8 w-8" />}
            title={hasFilters ? "Нет записей аудита, соответствующих текущим фильтрам" : "Записей аудита пока нет"}
            description={
              hasFilters
                ? "Измените или сбросьте фильтры, чтобы увидеть больше записей."
                : "Привилегированные действия будут записываться здесь по мере выполнения."
            }
            action={
              hasFilters ? (
                <Link
                  href="/audit"
                  className="inline-flex h-7 items-center rounded-md border border-line bg-raised px-2.5 text-xs text-neutral-300 transition-colors hover:border-line2 hover:text-white"
                >
                  Сбросить фильтры
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table className="min-w-[960px]">
              <THead>
                <TR>
                  <TH>Время</TH>
                  <TH>Исполнитель</TH>
                  <TH>Действие</TH>
                  <TH>Сущность</TH>
                  <TH>Детали</TH>
                  <TH>IP</TH>
                  <TH align="right"> </TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((row) => (
                  <AuditExpandRow
                    key={row.id}
                    row={row}
                    entityHref={entityHref(row.entityType, row.entityId)}
                  />
                ))}
              </TBody>
            </Table>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-neutral-500">
                <span>
                  {from}–{to} из {result.total}
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={href(page - 1)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-raised px-2.5 text-neutral-300 transition-colors hover:border-line2 hover:text-white"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Назад
                    </Link>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 opacity-50">
                      <ChevronLeft className="h-3.5 w-3.5" /> Назад
                    </span>
                  )}
                  <span>
                    Страница {page} / {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={href(page + 1)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-raised px-2.5 text-neutral-300 transition-colors hover:border-line2 hover:text-white"
                    >
                      Вперёд <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 opacity-50">
                      Вперёд <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
