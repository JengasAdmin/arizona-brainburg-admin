"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Label, Select } from "@/components/ui/input";

/**
 * Entity types actually written by writeAudit() in the codebase
 * (grepped from src/server/services + src/app/api) — nothing is invented.
 */
const ENTITY_TYPES = [
  "user",
  "user_role",
  "faction",
  "faction_position",
  "leadership_term",
  "disciplinary_action",
  "budget_transaction",
  "game_activity",
  "role",
  "system_setting",
  "integration_api_key",
  "session",
] as const;

export interface AuditFilters {
  q: string;
  action: string;
  entityType: string;
  actor: string;
}

const DEBOUNCE_MS = 350;

/** Debounced filter bar → replaces the current /audit href (page resets to 1). */
export function AuditToolbar({ filters }: { filters: AuditFilters }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const [action, setAction] = useState(filters.action);

  const apply = (entries: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `/audit?${qs}` : "/audit");
  };

  // Debounced free-text filters (target label search + exact action code).
  useEffect(() => {
    if (q === filters.q) return;
    const timer = setTimeout(() => apply({ q }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (action === filters.action) return;
    const timer = setTimeout(() => apply({ action }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const hasFilters = Boolean(
    filters.q || filters.action || filters.entityType || filters.actor,
  );

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-card p-3">
      <div className="min-w-[200px] flex-1">
        <Label htmlFor="audit-q">Поиск</Label>
        <Input
          id="audit-q"
          placeholder="Цель содержит…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="w-[200px]">
        <Label htmlFor="audit-action">Действие</Label>
        <Input
          id="audit-action"
          placeholder="например, UPDATE_PROFILE"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </div>
      <div className="w-[210px]">
        <Label htmlFor="audit-entity">Тип сущности</Label>
        <Select
          id="audit-entity"
          value={filters.entityType}
          onChange={(e) => apply({ entityType: e.target.value })}
        >
          <option value="">Все сущности</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[130px]">
        <Label htmlFor="audit-actor">ID автора</Label>
        <Input
          id="audit-actor"
          inputMode="numeric"
          placeholder="например, 1"
          defaultValue={filters.actor}
          onChange={(e) => apply({ actor: e.target.value.trim() })}
        />
      </div>
      {hasFilters ? (
        <Link
          href="/audit"
          className="pb-2 text-xs text-neutral-500 transition-colors hover:text-white"
        >
          Сбросить фильтры
        </Link>
      ) : null}
    </div>
  );
}
