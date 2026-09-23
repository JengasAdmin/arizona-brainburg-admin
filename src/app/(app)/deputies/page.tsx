import { requirePageAuth } from "@/server/page-auth";
import { listTerms } from "@/server/services/leadership";
import { listFactions } from "@/server/services/factions";
import { listPositionOptions } from "@/server/services/positions";
import { PageHeader } from "@/components/page-header";
import { AppointLeaderDialog } from "@/components/leadership/appoint-leader-dialog";
import { DeputiesTable } from "@/components/leadership/deputies-table";

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

export default async function DeputiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const auth = await requirePageAuth("VIEW_DEPUTIES");
  const sp = await searchParams;

  const q = (firstOf(sp.q) ?? "").trim().slice(0, 120) || undefined;
  const factionId = toFactionId(firstOf(sp.faction));
  const rawStatus = firstOf(sp.status);
  const status = rawStatus === "active" || rawStatus === "dismissed" ? rawStatus : undefined;
  const page = toPage(firstOf(sp.page));

  const [terms, factions, positions] = await Promise.all([
    listTerms({ kind: "deputy", q, factionId, status, page, pageSize: 25 }, auth.actor),
    listFactions(auth.actor),
    listPositionOptions(auth.actor),
  ]);

  // POST /api/deputies does not exist — deputy appointments go through
  // POST /api/leaders with a deputy-kind position, which requires MANAGE_DEPUTIES.
  const canAppoint = auth.permissions.has("MANAGE_DEPUTIES");
  // The dismiss endpoint checks DISMISS_LEADER regardless of position kind.
  const canDismiss = auth.permissions.has("DISMISS_LEADER");

  const factionOptions = factions.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div>
      <PageHeader
        title="Заместители"
        description="Заместители, назначенные руководителями"
        actions={
          canAppoint ? (
            <AppointLeaderDialog
              mode="deputy"
              label="Назначить заместителя"
              factions={factionOptions}
              positions={positions}
            />
          ) : null
        }
      />

      <DeputiesTable
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
      />
    </div>
  );
}
