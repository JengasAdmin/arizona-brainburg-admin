"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[200px] animate-fade rounded-lg border border-line bg-card p-1 shadow-popover",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "text-red-300 hover:bg-[#210f10]"
          : "text-neutral-300 hover:bg-raised hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
      {children}
    </div>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
