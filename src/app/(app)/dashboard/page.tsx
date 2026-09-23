import { requirePageAuth } from "@/server/page-auth";
import { getDashboard } from "@/server/services/dashboard";
import { PageHeader, StatCard } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { formatAuditSentence } from "@/lib/audit-format";
import { FileClock, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await requirePageAuth("VIEW_DASHBOARD");
  const { stats, recent } = await getDashboard(auth.actor);

  return (
    <div>
      <PageHeader
        title="Обзор"
        description={`Обзор Сервера #5 — ${auth.user.nickname ?? auth.user.displayName}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Зарегистрированные пользователи" value={stats.registeredUsers.toLocaleString("en-US")} href="/users" />
        <StatCard
          label="Пользователи в сети"
          value={stats.onlineUsers.toLocaleString("en-US")}
          hint="Активны за последние 15 минут"
        />
        <StatCard label="Активные руководители" value={stats.activeLeaders} href="/leaders?status=active" />
        <StatCard label="Активные заместители" value={stats.activeDeputies} href="/deputies?status=active" />
        <StatCard label="Всего фракций" value={stats.totalFactions} href="/factions" />
        <StatCard
          label="Ожидающие проверки"
          value={stats.pendingActions}
          hint="Game ID, ожидающие подтверждения"
          href="/users?unverifiedGameId=true"
        />
        <StatCard label="Непрочитанные уведомления" value={stats.unreadNotifications} href="/notifications" />
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Последняя активность"
            description="Кто, что, кому и когда — со старыми и новыми значениями."
            actions={
              <a
                href="/audit"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-white"
              >
                <FileClock className="h-3.5 w-3.5" /> Журнал аудита
              </a>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-8 w-8" />}
              title="Активность ещё не записана"
              description="Административные действия появятся здесь по мере выполнения."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <THead>
                  <TR>
                    <TH>Исполнитель</TH>
                    <TH>Действие</TH>
                    <TH>Цель</TH>
                    <TH>Причина</TH>
                    <TH align="right">Дата</TH>
                  </TR>
                </THead>
                <TBody>
                  {recent.map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <div className="text-neutral-200">{row.actorName ?? "Система"}</div>
                        {row.actorRole ? (
                          <div className="text-[11px] text-neutral-600">{row.actorRole}</div>
                        ) : null}
                      </TD>
                      <TD>
                        <Badge tone="neutral">{row.action}</Badge>
                      </TD>
                      <TD className="max-w-[260px]">
                        <div className="truncate text-neutral-300" title={formatAuditSentence(row)}>
                          {formatAuditSentence(row)}
                        </div>
                      </TD>
                      <TD className="max-w-[200px] truncate text-neutral-500" >
                        {row.reason ?? "—"}
                      </TD>
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
    </div>
  );
}
