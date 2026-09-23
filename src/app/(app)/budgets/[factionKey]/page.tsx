import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/server/page-auth";
import { getBudgetDetail } from "@/server/services/budget";
import { listFactions } from "@/server/services/factions";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NewTransactionDialog } from "@/components/budgets/new-transaction-dialog";
import { formatDateTime, formatMoney, formatSignedMoney } from "@/lib/utils";
import { ArrowLeft, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

type BudgetParams = Promise<{ factionKey: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

function pageHref(page: number): string {
  return `?page=${page}`;
}

function parsePage(raw: string | string[] | undefined): number {
  const value = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export default async function BudgetDetailPage({
  params,
  searchParams,
}: {
  params: BudgetParams;
  searchParams: SearchParams;
}) {
  const { factionKey } = await params;
  const query = await searchParams;
  const page = parsePage(query.page);

  const auth = await requirePageAuth("VIEW_BUDGET");

  // URL carries the stable faction key — resolve to the numeric id the API expects.
  const summary = (await listFactions(auth.actor)).find((f) => f.key === factionKey);
  if (!summary) notFound();

  const budget = await getBudgetDetail(summary.id, auth.actor, page, 25);
  const canTransact = auth.permissions.has("MANAGE_BUDGET");
  const pages = Math.max(1, Math.ceil(budget.total / budget.pageSize));

  return (
    <div>
      <PageHeader
        title={`${budget.factionName} — Ledger`}
        description="Ledger-derived balances — immutable transactions"
        actions={
          <>
            <Link
              href="/budgets"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All budgets
            </Link>
            {canTransact ? (
              <NewTransactionDialog factionId={budget.factionId} balance={budget.balance} />
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Current balance"
          value={<span className="font-mono">{formatMoney(budget.balance)}</span>}
          hint="Changes only with a transaction"
        />
        <StatCard
          label="Transactions"
          value={budget.total.toLocaleString("en-US")}
          hint="Immutable ledger entries"
        />
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Transactions"
            description="Newest first — balance after each entry is written into the ledger."
          />
          {budget.transactions.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8" />}
              title="No transactions yet"
              description="Deposits and withdrawals recorded for this faction will appear here."
            />
          ) : (
            <>
              <Table className="min-w-[720px]">
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Type</TH>
                    <TH align="right">Amount</TH>
                    <TH align="right">Balance after</TH>
                    <TH>Reason</TH>
                  </TR>
                </THead>
                <TBody>
                  {budget.transactions.map((tx) => (
                    <TR key={tx.id}>
                      <TD className="whitespace-nowrap text-neutral-500">
                        {formatDateTime(tx.createdAt)}
                      </TD>
                      <TD>
                        <StatusBadge status={tx.type} />
                      </TD>
                      <TD
                        align="right"
                        className={`font-mono ${tx.amount >= 0 ? "text-ok" : "text-danger"}`}
                      >
                        {formatSignedMoney(tx.amount)}
                      </TD>
                      <TD align="right" className="font-mono text-neutral-300">
                        {formatMoney(tx.balanceAfter)}
                      </TD>
                      <TD className="max-w-[280px]">
                        <div className="truncate text-neutral-300" title={tx.reason}>
                          {tx.reason}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {pages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <span className="text-xs text-neutral-500">
                    Page {budget.page} of {pages} — {budget.total} entries
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={pageHref(budget.page - 1)}
                      aria-disabled={budget.page <= 1}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium transition-colors ${
                        budget.page <= 1
                          ? "pointer-events-none border-line/60 text-neutral-700"
                          : "bg-raised text-neutral-200 hover:bg-[#262626] hover:text-white"
                      }`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Link>
                    <Link
                      href={pageHref(budget.page + 1)}
                      aria-disabled={budget.page >= pages}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                        budget.page >= pages
                          ? "pointer-events-none border-line/60 text-neutral-700"
                          : "bg-raised text-neutral-200 hover:bg-[#262626] hover:text-white"
                      }`}
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
