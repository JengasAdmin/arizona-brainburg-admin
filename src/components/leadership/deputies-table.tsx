"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, UserSquare2 } from "lucide-react";
import type { TermListItem } from "@/server/services/leadership";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RowActions } from "./row-actions";
import type { FactionOption, LeadershipFilters } from "./leadership-table";

/**
 * Deputies list: debounced search + faction/status filters and the deputy
 * terms table. Dismiss is gated by DISMISS_LEADER — that is the permission the
 * dismiss endpoint enforces for every term kind.
 */
export function DeputiesTable({
  rows,
  factions,
  filters,
  total,
  pageSize,
  canDismiss,
}: {
  rows: TermListItem[];
  factions: FactionOption[];
  filters: LeadershipFilters;
  total: number;
  pageSize: number;
  canDismiss: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [qInput, setQInput] = useState(filters.q);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  function hrefFor(overrides: { q?: string; faction?: string; status?: string; page?: number }) {
    const current = filtersRef.current;
    const q = (overrides.q ?? current.q).trim();
    const faction = overrides.faction ?? current.faction;
    const status = overrides.status ?? current.status;
    const page = overrides.page ?? 1;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (faction) params.set("faction", faction);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  useEffect(() => {
    if (qInput === filters.q) return;
    const timer = window.setTimeout(() => {
      const next = qInput.trim();
      if (next === filtersRef.current.q) return;
      router.replace(hrefFor({ q: next }));
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, filters.q]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by name or ID…"
            aria-label="Search deputies"
            className="h-8 pl-8"
          />
        </div>

        <Select
          value={filters.faction}
          onChange={(e) => router.replace(hrefFor({ faction: e.target.value }))}
          aria-label="Filter by faction"
          className="h-8 w-auto max-w-[220px]"
        >
          <option value="">All factions</option>
          {factions.map((faction) => (
            <option key={faction.id} value={String(faction.id)}>
              {faction.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(e) => router.replace(hrefFor({ status: e.target.value }))}
          aria-label="Filter by status"
          className="h-8 w-auto"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="dismissed">Dismissed</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UserSquare2 className="h-8 w-8" />}
          title="No deputies found"
          description="Adjust the filters, or appoint a deputy to start the record."
        />
      ) : (
        <Table className="min-w-[860px]">
          <THead>
            <TR>
              <TH>Deputy</TH>
              <TH>Appointed by</TH>
              <TH>Faction</TH>
              <TH>Since</TH>
              <TH>Status</TH>
              <TH align="right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link href={`/leaders/${row.userId}`} className="flex items-center gap-2.5">
                    <Avatar src={row.avatarUrl} name={row.displayName} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-neutral-200">
                        {row.displayName}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-600">
                        {row.positionTitle}
                      </span>
                    </span>
                  </Link>
                </TD>
                <TD className="max-w-[180px] truncate">{row.appointedBy ?? "—"}</TD>
                <TD>
                  <Badge tone="neutral">{row.factionName}</Badge>
                </TD>
                <TD className="whitespace-nowrap text-neutral-500">
                  {formatDate(row.appointedAt)}
                </TD>
                <TD>
                  <StatusBadge status={row.status} />
                </TD>
                <TD align="right">
                  <div className="flex justify-end">
                    <RowActions
                      term={row}
                      canDismiss={canDismiss}
                      canPoints={false}
                      canDisciplinary={false}
                      historyHref={`/leaders/${row.userId}`}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination
        page={filters.page}
        pageSize={pageSize}
        total={total}
        onPage={(next) => router.replace(hrefFor({ page: next }))}
      />
    </Card>
  );
}
