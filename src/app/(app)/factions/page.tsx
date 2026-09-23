import Link from "next/link";
import { requirePageAuth } from "@/server/page-auth";
import { listFactions, type FactionListItem } from "@/server/services/factions";
import { PageHeader } from "@/components/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { FACTIONS, FACTION_CATEGORIES } from "@/lib/catalog/factions";
import { formatMoney } from "@/lib/utils";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

const CATALOG_BY_KEY = new Map(FACTIONS.map((f) => [f.key, f]));

/** Category keys in catalog order, followed by any unexpected extra keys. */
function orderedCategoryKeys(groups: Map<string, FactionListItem[]>): string[] {
  const known = FACTION_CATEGORIES.map((c) => c.key).filter((key) => groups.has(key));
  const extra = [...groups.keys()].filter((key) => !FACTION_CATEGORIES.some((c) => c.key === key));
  return [...known, ...extra];
}

function categoryName(key: string, items: FactionListItem[]): string {
  return FACTION_CATEGORIES.find((c) => c.key === key)?.name ?? items[0]?.categoryName ?? key;
}

export default async function FactionsPage() {
  const auth = await requirePageAuth("VIEW_FACTIONS");
  const factions = await listFactions(auth.actor);
  const canViewBudget = auth.permissions.has("VIEW_BUDGET");

  const groups = new Map<string, FactionListItem[]>();
  for (const faction of factions) {
    const bucket = groups.get(faction.categoryKey);
    if (bucket) bucket.push(faction);
    else groups.set(faction.categoryKey, [faction]);
  }

  return (
    <div>
      <PageHeader
        title="Фракции"
        description="14 фракций в 7 категориях — Сервер #5"
      />

      {factions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Shield className="h-8 w-8" />}
            title="Нет фракций в вашей области"
            description="Фракции, закреплённые за вашей зоной надзора, появятся здесь."
          />
        </Card>
      ) : (
        orderedCategoryKeys(groups).map((categoryKey) => {
          const items = groups.get(categoryKey) ?? [];
          return (
            <section key={categoryKey} className="mt-5 first:mt-0">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                {categoryName(categoryKey, items)}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((faction) => {
                  const description =
                    faction.description ?? CATALOG_BY_KEY.get(faction.key)?.description ?? null;
                  return (
                    <Link
                      key={faction.id}
                      href={`/factions/${faction.key}`}
                      className="block rounded-lg border border-line bg-card p-4 transition-colors hover:border-line2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{faction.name}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge>{faction.categoryName}</Badge>
                            <Badge tone="info">{faction.shortName}</Badge>
                          </div>
                        </div>
                        <StatusBadge status={faction.status} />
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                        {description ?? "—"}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
                        <span>Участников: {faction.members}</span>
                        <span>Руководителей: {faction.activeLeaders}</span>
                        <span>Заместителей: {faction.activeDeputies}</span>
                        {canViewBudget ? (
                          <span className="ml-auto font-medium text-neutral-400">
                            {formatMoney(faction.budget)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
