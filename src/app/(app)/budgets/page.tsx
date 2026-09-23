import Link from "next/link";
import { requirePageAuth } from "@/server/page-auth";
import { listBudgets } from "@/server/services/budget";
import { listFactions } from "@/server/services/factions";
import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DEPARTMENTS } from "@/lib/rbac/roles";
import { formatMoney } from "@/lib/utils";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

function departmentName(departmentKey: string): string {
  return DEPARTMENTS.find((d) => d.key === departmentKey)?.name ?? departmentKey;
}

export default async function BudgetsPage() {
  const auth = await requirePageAuth("VIEW_BUDGET");

  // listBudgets returns factionId (no slug) — resolve stable keys for the ledger links.
  const [items, factions] = await Promise.all([
    listBudgets(auth.actor),
    listFactions(auth.actor),
  ]);
  const factionByKey = new Map(factions.map((f) => [f.id, f]));

  const totalBalance = items.reduce((sum, item) => sum + item.balance, 0);
  const canTransact = auth.permissions.has("MANAGE_BUDGET");

  return (
    <div>
      <PageHeader
        title="Бюджеты"
        description="Балансы по регистру — неизменяемые транзакции"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Общий баланс" value={formatMoney(totalBalance)} hint="Сумма счетов фракций" />
        <StatCard label="Счета фракций" value={items.length.toLocaleString("en-US")} href="/factions" />
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Балансы фракций"
            description="Текущий баланс не может измениться без соответствующей транзакции."
          />
          {items.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-8 w-8" />}
              title="Нет бюджетов в вашей области"
              description="Бюджетные счета фракций, закреплённые за вашей зоной надзора, появятся здесь."
            />
          ) : (
            <CardBody padded={false}>
              <Table className="min-w-[640px]">
                <THead>
                  <TR>
                    <TH>Фракция</TH>
                    <TH>Направление</TH>
                    <TH align="right">Баланс</TH>
                    <TH align="right">Действия</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((item) => {
                    const faction = factionByKey.get(item.factionId);
                    const href = faction ? `/budgets/${faction.key}` : null;
                    return (
                      <TR key={item.factionId}>
                        <TD>
                          {href ? (
                            <Link
                              href={href}
                              className="text-neutral-100 transition-colors hover:text-white"
                            >
                              {item.factionName}
                            </Link>
                          ) : (
                            <span className="text-neutral-100">{item.factionName}</span>
                          )}
                          <div className="mt-0.5">
                            <Badge tone="info">{item.factionShort}</Badge>
                          </div>
                        </TD>
                        <TD className="text-neutral-500">
                          {faction ? departmentName(faction.departmentKey) : "—"}
                        </TD>
                        <TD align="right" className="font-mono text-neutral-100">
                          {formatMoney(item.balance)}
                        </TD>
                        <TD align="right">
                          {href ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={href}
                                className="inline-flex h-7 items-center rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
                              >
                                Посмотреть регистр
                              </Link>
                              {canTransact ? (
                                <Link
                                  href={href}
                                  className="inline-flex h-7 items-center rounded-md border border-transparent bg-white px-2.5 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
                                >
                                  Новая транзакция
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-neutral-600">—</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}
