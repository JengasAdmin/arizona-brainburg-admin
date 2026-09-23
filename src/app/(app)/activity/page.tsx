import Link from "next/link";
import { requirePageAuth } from "@/server/page-auth";
import { listActivity } from "@/server/services/activity";
import { listFactions } from "@/server/services/factions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LogActivityDialog } from "@/components/activity/log-activity-dialog";
import { formatDateTime, formatUserId } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Gamepad2 } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  action?: string | string[];
  userId?: string | string[];
  source?: string | string[];
  page?: string | string[];
}>;

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pageHref(page: number, filters: { action?: string; userId?: string; source?: string }): string {
  const qs = new URLSearchParams();
  if (filters.action) qs.set("action", filters.action);
  if (filters.userId) qs.set("userId", filters.userId);
  if (filters.source) qs.set("source", filters.source);
  qs.set("page", String(page));
  return `?${qs.toString()}`;
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const auth = await requirePageAuth("VIEW_ACTIVITY");

  const action = str(query.action);
  const sourceRaw = str(query.source);
  const source =
    sourceRaw === "manual" || sourceRaw === "integration" ? sourceRaw : undefined;
  const userIdRaw = str(query.userId);
  const userIdNum = userIdRaw !== undefined ? Number(userIdRaw) : NaN;
  const userId = Number.isInteger(userIdNum) && userIdNum > 0 ? userIdNum : undefined;

  const pageRaw = Number(str(query.page) ?? "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const canLog = auth.permissions.has("CREATE_GAME_ACTIVITY");
  const [result, factions] = await Promise.all([
    listActivity({ page, pageSize: 25, userId, action, source }, auth.actor),
    canLog
      ? listFactions(auth.actor)
      : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filters = {
    action,
    userId: userId !== undefined ? String(userId) : undefined,
    source,
  };

  return (
    <div>
      <PageHeader
        title="Активность"
        description="Ручные записи игровых сессий"
        actions={canLog ? <LogActivityDialog factions={factions.map((f) => ({ id: f.id, name: f.name }))} /> : null}
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full max-w-[220px]">
            <Label htmlFor="filter-action">Действие (точное совпадение)</Label>
            <Input
              id="filter-action"
              name="action"
              defaultValue={action ?? ""}
              placeholder="Патрульная смена"
            />
          </div>
          <div className="w-full max-w-[160px]">
            <Label htmlFor="filter-user">ID пользователя</Label>
            <Input
              id="filter-user"
              name="userId"
              type="number"
              min={1}
              defaultValue={userId !== undefined ? String(userId) : ""}
              placeholder="124"
            />
          </div>
          <div className="w-full max-w-[180px]">
            <Label htmlFor="filter-source">Источник</Label>
            <Select id="filter-source" name="source" defaultValue={source ?? ""}>
              <option value="">Все источники</option>
              <option value="manual">Вручную</option>
              <option value="integration">Интеграция</option>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="submit" size="sm" variant="secondary">
              Применить фильтры
            </Button>
            <Link
              href="/activity"
              className="inline-flex h-7 items-center px-2.5 text-xs text-neutral-500 transition-colors hover:text-white"
            >
              Сбросить
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Записи"
          description={`Записей в вашей области: ${result.total}`}
        />
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Gamepad2 className="h-8 w-8" />}
            title="Активность пока не записана"
            description="Записи игровых сессий появятся здесь после добавления."
          />
        ) : (
          <>
            <Table className="min-w-[860px]">
              <THead>
                <TR>
                  <TH>Дата и время</TH>
                  <TH>Пользователь</TH>
                  <TH>Действие</TH>
                  <TH>Источник</TH>
                  <TH>Описание</TH>
                  <TH>Фракция</TH>
                  <TH>Кем записано</TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-neutral-500">
                      {formatDateTime(row.occurredAt)}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Avatar src={row.avatarUrl} name={row.displayName} size={24} />
                        <div className="min-w-0">
                          <div className="truncate text-neutral-200">{row.displayName}</div>
                          <div className="text-[11px] text-neutral-600">
                            {row.nickname ?? formatUserId(row.userId)}
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone="neutral">{row.action}</Badge>
                    </TD>
                    <TD>
                      <StatusBadge status={row.source} />
                    </TD>
                    <TD className="max-w-[260px]">
                      <div className="truncate text-neutral-300" title={row.description}>
                        {row.description}
                      </div>
                    </TD>
                    <TD className="text-neutral-500">{row.factionName ?? "—"}</TD>
                    <TD className="text-neutral-500">{row.createdBy ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            {pages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <span className="text-xs text-neutral-500">
                  Страница {result.page} из {pages} — записей: {result.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={pageHref(result.page - 1, filters)}
                    aria-disabled={result.page <= 1}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      result.page <= 1
                        ? "pointer-events-none border-line/60 text-neutral-700"
                        : "border-line bg-raised text-neutral-200 hover:bg-[#262626] hover:text-white"
                    }`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Назад
                  </Link>
                  <Link
                    href={pageHref(result.page + 1, filters)}
                    aria-disabled={result.page >= pages}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      result.page >= pages
                        ? "pointer-events-none border-line/60 text-neutral-700"
                        : "border-line bg-raised text-neutral-200 hover:bg-[#262626] hover:text-white"
                    }`}
                  >
                    Вперёд <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
