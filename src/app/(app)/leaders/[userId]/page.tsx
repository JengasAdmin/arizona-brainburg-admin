import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, ShieldAlert } from "lucide-react";
import { requirePageAuth } from "@/server/page-auth";
import { loadPublicProfile } from "@/server/auth/access";
import { getTermHistory, listTerms } from "@/server/services/leadership";
import { PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/leadership/row-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime, formatUserId } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-neutral-600">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-neutral-200">{value}</dd>
    </div>
  );
}

export default async function LeaderHistoryPage({ params }: { params: Params }) {
  const auth = await requirePageAuth("VIEW_LEADERS");
  const raw = (await params).userId;
  const rawId = Array.isArray(raw) ? raw[0] : raw;
  const userId = Number.parseInt(rawId ?? "", 10);
  if (!Number.isFinite(userId) || userId <= 0) notFound();

  const [profile, terms] = await Promise.all([
    loadPublicProfile(userId),
    listTerms({ userId, page: 1, pageSize: 100 }, auth.actor),
  ]);
  if (!profile) notFound();

  // Server-side disciplinary record: there is no per-user history endpoint,
  // so aggregate the per-term history (GET /api/leaders/:termId/history).
  const histories = await Promise.all(terms.items.map((term) => getTermHistory(term.id)));
  const disciplinary = terms.items
    .flatMap((term, index) =>
      histories[index].disciplinary.map((entry) => ({ ...entry, term })),
    )
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

  const canDismiss = auth.permissions.has("DISMISS_LEADER");
  const canPoints = auth.permissions.has("EDIT_LEADER_POINTS");
  const canDisciplinary =
    auth.permissions.has("GIVE_WARNING") || auth.permissions.has("GIVE_REPRIMAND");

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            <Avatar src={profile.avatarUrl} name={profile.displayName} size={30} />
            {profile.displayName}
            <Badge tone="neutral">{formatUserId(profile.id)}</Badge>
            <StatusBadge status={profile.status} />
          </span>
        }
        description="История полномочий"
        actions={
          <Link
            href="/leaders"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Назад к руководителям
          </Link>
        }
      />

      {terms.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-8 w-8" />}
            title="Нет сроков полномочий"
            description="Этот пользователь никогда не занимал должность руководителя или заместителя."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {terms.items.map((term) => (
            <Card key={term.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {term.positionTitle}
                    <Badge tone="neutral">{term.factionName}</Badge>
                  </span>
                }
                description={`Срок #${term.termNumber}`}
                actions={
                  <span className="flex items-center gap-2">
                    <StatusBadge status={term.status} />
                    {term.status === "active" ? (
                      <RowActions
                        term={term}
                        canDismiss={canDismiss}
                        canPoints={canPoints && term.status === "active"}
                        canDisciplinary={canDisciplinary && term.status === "active"}
                      />
                    ) : null}
                  </span>
                }
              />
              <CardBody>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <DetailRow label="Кем назначен" value={term.appointedBy ?? "—"} />
                  <DetailRow label="Начало" value={formatDate(term.appointedAt)} />
                  <DetailRow
                    label="Конец"
                    value={
                      term.dismissedAt
                        ? formatDate(term.dismissedAt)
                        : term.status === "active"
                          ? "по настоящее время"
                          : "—"
                    }
                  />
                </dl>
                {term.dismissalReason ? (
                  <div className="mt-3 rounded-md border border-line bg-panel px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-600">
                      Причина отстранения
                    </div>
                    <div className="mt-0.5 text-[13px] text-neutral-300">
                      {term.dismissalReason}
                    </div>
                    {term.dismissedBy ? (
                      <div className="mt-1 text-[11px] text-neutral-600">
                        Инициатор отстранения: {term.dismissedBy}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Дисциплинарные взыскания"
            description="Предупреждения и выговоры, выданные за все сроки полномочий."
          />
          {disciplinary.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-8 w-8" />}
              title="Дисциплинарных взысканий в записи нет."
            />
          ) : (
            <Table className="min-w-[720px]">
              <THead>
                <TR>
                  <TH>Тип</TH>
                  <TH>Причина</TH>
                  <TH>Срок</TH>
                  <TH>Кем выдано</TH>
                  <TH align="right">Дата</TH>
                </TR>
              </THead>
              <TBody>
                {disciplinary.map((entry) => (
                  <TR key={entry.id}>
                    <TD>
                      <Badge tone={entry.type === "reprimand" ? "danger" : "warn"}>
                        {entry.type === "reprimand"
                          ? "Выговор"
                          : entry.type === "warning"
                            ? "Предупреждение"
                            : entry.type}
                      </Badge>
                    </TD>
                    <TD className="max-w-[320px]">
                      <div className="truncate text-neutral-300" title={entry.reason}>
                        {entry.reason}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-neutral-300">{entry.term.positionTitle}</div>
                      <div className="text-[11px] text-neutral-600">
                        {entry.term.factionName} · Срок #{entry.term.termNumber}
                      </div>
                    </TD>
                    <TD>{entry.issuedBy ?? "—"}</TD>
                    <TD align="right" className="whitespace-nowrap text-neutral-500">
                      {formatDateTime(entry.issuedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
