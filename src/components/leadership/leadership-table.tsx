"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crown, Search } from "lucide-react";
import type { TermListItem } from "@/server/services/leadership";
import { formatDate, formatUserId } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RowActions } from "./row-actions";

export interface LeadershipFilters {
  q: string;
  faction: string;
  status: string;
  page: number;
}

export interface FactionOption {
  id: number;
  name: string;
}

/**
 * Leaders list: debounced search + faction/status filters (href query) and the
 * terms table with per-row actions. Presentational — all data comes from the
 * server page as plain serializable props.
 */
export function LeadershipTable({
  rows,
  factions,
  filters,
  total,
  pageSize,
  canDismiss,
  canPoints,
  canDisciplinary,
}: {
  rows: TermListItem[];
  factions: FactionOption[];
  filters: LeadershipFilters;
  total: number;
  pageSize: number;
  canDismiss: boolean;
  canPoints: boolean;
  canDisciplinary: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [qInput, setQInput] = useState(filters.q);

  // Always navigate against the freshest filters (a debounce timer may fire
  // after the user changed another filter).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  function hrefFor(overrides: { q?: string; faction?: string; status?: string; page?: number }) {
    const current = filtersRef.current;
    const q = (overrides.q ?? current.q).trim();
    const faction = overrides.faction ?? current.faction;
    const status = overrides.status ?? current.status;
    // Any filter change resets to the first page unless a page is explicit.
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
            placeholder="Поиск по имени или ID…"
            aria-label="Поиск руководителей"
            className="h-8 pl-8"
          />
        </div>

        <Select
          value={filters.faction}
          onChange={(e) => router.replace(hrefFor({ faction: e.target.value }))}
          aria-label="Фильтр по фракции"
          className="h-8 w-auto max-w-[220px]"
        >
          <option value="">Все фракции</option>
          {factions.map((faction) => (
            <option key={faction.id} value={String(faction.id)}>
              {faction.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(e) => router.replace(hrefFor({ status: e.target.value }))}
          aria-label="Фильтр по статусу"
          className="h-8 w-auto"
        >
          <option value="">Все статусы</option>
          <option value="active">Активен</option>
          <option value="dismissed">Отстранён</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Crown className="h-8 w-8" />}
          title="Назначения руководителей не найдены"
          description="Измените фильтры или назначьте руководителя, чтобы начать вести журнал."
        />
      ) : (
        <Table className="min-w-[940px]">
          <THead>
            <TR>
              <TH>Руководитель</TH>
              <TH>Должность</TH>
              <TH>Фракция</TH>
              <TH>Назначил</TH>
              <TH>С</TH>
              <TH>Статус</TH>
              <TH align="right">Действия</TH>
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
                        {row.nickname ?? formatUserId(row.userId)}
                      </span>
                    </span>
                  </Link>
                </TD>
                <TD>
                  <div className="text-neutral-200">{row.positionTitle}</div>
                  <div className="text-[11px] text-neutral-600">Срок №{row.termNumber}</div>
                </TD>
                <TD>
                  <Badge tone="neutral">{row.factionName}</Badge>
                </TD>
                <TD className="max-w-[160px] truncate">{row.appointedBy ?? "—"}</TD>
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
                      canPoints={canPoints}
                      canDisciplinary={canDisciplinary}
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
