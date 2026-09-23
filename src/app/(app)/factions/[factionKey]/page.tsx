import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/server/page-auth";
import { getFactionDetail, listFactions } from "@/server/services/factions";
import { listBudgets } from "@/server/services/budget";
import { PageHeader } from "@/components/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FactionEditDialog } from "@/components/factions/faction-edit-dialog";
import { FactionAudit } from "@/components/factions/faction-audit";
import { PositionsManager } from "@/components/factions/positions-manager";
import { DEPARTMENTS } from "@/lib/rbac/roles";
import { formatDate, formatMoney } from "@/lib/utils";
import { ArrowRight, ScrollText, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

type FactionParams = Promise<{ factionKey: string }>;

function departmentName(departmentKey: string): string {
  return DEPARTMENTS.find((d) => d.key === departmentKey)?.name ?? departmentKey;
}

export default async function FactionDetailPage({ params }: { params: FactionParams }) {
  const { factionKey } = await params;
  const auth = await requirePageAuth("VIEW_FACTIONS");

  // The service layer resolves factions by numeric id — map the URL key first.
  const summary = (await listFactions(auth.actor)).find((f) => f.key === factionKey);
  if (!summary) notFound();

  const faction = await getFactionDetail(summary.id, auth.actor);

  const canEdit = auth.permissions.has("EDIT_FACTION");
  const canViewBudget = auth.permissions.has("VIEW_BUDGET");
  const balance = canViewBudget
    ? (await listBudgets(auth.actor)).find((b) => b.factionId === faction.id)?.balance ?? 0
    : null;

  return (
    <div>
      <PageHeader
        title={faction.name}
        description={`${faction.categoryName} — ${departmentName(faction.departmentKey)} · /${faction.key}`}
        actions={
          <>
            <StatusBadge status={faction.status} />
            {canEdit ? (
              <FactionEditDialog
                factionId={faction.id}
                initial={{
                  name: faction.name,
                  shortName: faction.shortName,
                  description: faction.description ?? "",
                  status: faction.status,
                }}
              />
            ) : null}
            {canEdit ? (
              <a
                href="#positions"
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
              >
                <Settings2 className="h-3.5 w-3.5" /> Manage positions
              </a>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Description" />
          <CardBody>
            <p className="text-[13px] leading-relaxed text-neutral-300">
              {faction.description ?? "—"}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Metadata" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Key</dt>
                <dd className="text-[13px] text-neutral-200">{faction.key}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Short name</dt>
                <dd className="text-[13px] text-neutral-200">{faction.shortName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Category</dt>
                <dd className="text-[13px] text-neutral-200">
                  <Badge>{faction.categoryName}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Direction</dt>
                <dd className="text-[13px] text-neutral-200">
                  {departmentName(faction.departmentKey)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Created</dt>
                <dd className="text-[13px] text-neutral-200">{formatDate(faction.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Status</dt>
                <dd className="text-[13px] text-neutral-200">
                  <StatusBadge status={faction.status} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">Members</dt>
                <dd className="text-[13px] text-neutral-200">{faction.members}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">
                  Active leaders
                </dt>
                <dd className="text-[13px] text-neutral-200">{faction.activeLeaders}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">
                  Active deputies
                </dt>
                <dd className="text-[13px] text-neutral-200">{faction.activeDeputies}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">
                  Multiple leaders
                </dt>
                <dd className="text-[13px] text-neutral-200">
                  {faction.allowMultipleLeaders ? "Allowed" : "Not allowed"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-600">
                  Cross-faction leadership
                </dt>
                <dd className="text-[13px] text-neutral-200">
                  {faction.allowCrossFactionLeadership ? "Allowed" : "Not allowed"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-3" id="positions">
        <PositionsManager
          factionId={faction.id}
          positions={faction.positions}
          canManage={canEdit}
        />
      </div>

      {canViewBudget ? (
        <div className="mt-3">
          <Card>
            <CardHeader
              title="Budget"
              description="Ledger-derived balance — every change requires a transaction."
              actions={
                <Link
                  href={`/budgets/${faction.key}`}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-white"
                >
                  Open ledger <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <CardBody>
              <div className="font-mono text-2xl font-semibold tracking-tight text-white">
                {formatMoney(balance)}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="mt-3">
        <Card>
          <CardHeader
            title="Audit Log"
            description="Immutable history of changes to this faction."
            actions={
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <ScrollText className="h-3.5 w-3.5" /> Audit
              </span>
            }
          />
          <FactionAudit factionId={faction.id} />
        </Card>
      </div>
    </div>
  );
}
