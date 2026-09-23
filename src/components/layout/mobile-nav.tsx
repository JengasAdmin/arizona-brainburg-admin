"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { SERVER_LABEL } from "@/lib/constants";

/** Mobile navigation — the sidebar becomes a slide-in drawer. */
export function MobileNav({ allowedHrefs }: { allowedHrefs: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-raised text-neutral-300 transition-colors hover:text-white lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-[264px] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white" />
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-white">ARIZONA RP</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                    Brainburg · {SERVER_LABEL}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-neutral-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav allowedHrefs={allowedHrefs} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
