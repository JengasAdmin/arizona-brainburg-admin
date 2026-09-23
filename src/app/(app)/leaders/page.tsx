import { requirePageAuth } from "@/server/page-auth";
import { listTerms } from "@/server/services/leadership";
import { listFactions } from "@/server/services/factions";
import { listPositionOptions } from "@/server/services/positions";
import { PageHeader, StatCard } from "@/components/page-header";
import { AppointLeaderDialog } from "@/components/leadership/appoint-leader-dialog";
import { LeadershipTable } from "@/components/leadership/leadership-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstOf(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function toFactionId(value: string | undefined): number | undefined {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const auth = await requirePageAuth("VIEW_LEADERS");
  const sp = await searchParams;

  const q = (firstOf(sp.q) ?? "").trim().slice(0, 120) || undefined;
  const factionId = toFactionId(firstOf(sp.faction));
  const rawStatus = firstOf(sp.status);
  const status = rawStatus === "active" || rawStatus === "dismissed" ? rawStatus : undefined;
  const page = toPage(firstOf(sp.page));

  const [terms, activeStats, totalStats, factions, positions] = await Promise.all([
    listTerms({ kind: "leader", q, factionId, status, page, pageSize: 25 }, auth.actor),
    listTerms({ kind: "leader", status: "active", page: 1, pageSize: 1 }, auth.actor),
    listTerms({ kind: "leader", page: 1, pageSize: 1 }, auth.actor),
    listFactions(auth.actor),
    listPositionOptions(auth.actor),
  ]);

  const canAppoint = auth.permissions.has("APPOINT_LEADER");
  const canDismiss = auth.permissions.has("DISMISS_LEADER");
  const canPoints = auth.permissions.has("EDIT_LEADER_POINTS");
  const canDisciplinary =
    auth.permissions.has("GIVE_WARNING") || auth.permissions.has("GIVE_REPRIMAND");

  const factionOptions = factions.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div>
      <PageHeader
        title="Leadership"
        description="Current and historical leadership terms — immutable records"
        actions={
          canAppoint ? (
            <AppointLeaderDialog
              mode="leader"
              label="Appoint leader"
              factions={factionOptions}
              positions={positions}
            />
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Active leaders" value={activeStats.total} href="/leaders?status=active" />
        <StatCard
          label="Total terms"
          value={totalStats.total}
          hint="Leadership terms on record"
          href="/leaders"
        />
      </div>

      <LeadershipTable
        rows={terms.items}
        factions={factionOptions}
        filters={{
          q: q ?? "",
          faction: factionId ? String(factionId) : "",
          status: status ?? "",
          page,
        }}
        total={terms.total}
        pageSize={terms.pageSize}
        canDismiss={canDismiss}
        canPoints={canPoints}
        canDisciplinary={canDisciplinary}
      />
    </div>
  );
}
