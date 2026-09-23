"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first interactive element for keyboard users.
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input, textarea, select, button:not([aria-label='Close'])",
      );
      focusable?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Dialog"}
        className={cn(
          "relative z-10 w-full animate-fade rounded-t-lg border border-line bg-card shadow-popover sm:rounded-lg",
          width,
          "max-h-[90vh] overflow-y-auto",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs text-neutral-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 transition-colors hover:bg-raised hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="px-4 py-4">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface ConfirmRequest {
  title: string;
  description?: React.ReactNode;
  fields?: { label: string; value: React.ReactNode }[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
