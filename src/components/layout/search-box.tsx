"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SearchResults } from "@/server/services/search-types";

/** Global search: nickname, Game ID, internal User ID, Discord/VK ID, faction, position. */
export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<SearchResults>(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  };

  const hasResults =
    results && (results.users.length > 0 || results.factions.length > 0 || results.positions.length > 0);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search users, factions, positions…"
          aria-label="Global search"
          className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-7 text-[13px] text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-raised px-1 text-[10px] text-neutral-600 sm:block">
            ⌘K
          </kbd>
        )}
      </div>

      {open && (query.trim().length > 0 || loading) ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-popover">
          {loading ? (
            <div className="px-2.5 py-3 text-xs text-neutral-600">Searching…</div>
          ) : !hasResults ? (
            <div className="px-2.5 py-3 text-xs text-neutral-600">No results for “{query}”.</div>
          ) : (
            <>
              {results!.users.map((user) => (
                <button
                  key={`u-${user.id}`}
                  type="button"
                  onClick={() => go(`/users/${user.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-neutral-200">
                      {user.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-600">
                      {user.nickname ?? "—"}
                      {user.gameId ? ` · Game ID ${user.gameId}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-600">#{user.id}</span>
                </button>
              ))}
              {results!.factions.map((faction) => (
                <button
                  key={`f-${faction.id}`}
                  type="button"
                  onClick={() => go(`/factions/${faction.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-raised"
                >
                  <span className="truncate text-[13px] text-neutral-200">{faction.name}</span>
                  <span className="shrink-0 text-[11px] text-neutral-600">{faction.shortName}</span>
                </button>
              ))}
              {results!.positions.map((position) => (
                <button
                  key={`p-${position.id}`}
                  type="button"
                  onClick={() => go(`/factions/${position.factionId}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-raised"
                >
                  <span className="truncate text-[13px] text-neutral-200">{position.title}</span>
                  <span className="shrink-0 text-[11px] text-neutral-600">
                    {position.factionName}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
