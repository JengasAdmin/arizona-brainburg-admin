"use client";

import { Button } from "./button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="text-xs text-neutral-500">
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Назад"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-1 text-xs text-neutral-400">
          Стр. {page} из {pages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Далее"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
