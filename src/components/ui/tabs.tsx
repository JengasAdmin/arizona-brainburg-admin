"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors",
              active ? "text-white" : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="ml-1.5 text-[11px] text-neutral-600">{item.count}</span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-px bg-white" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
