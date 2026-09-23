"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";

/**
 * Client navigation list — the server passes only the *allowed hrefs*
 * (functions are not serializable across the server/client boundary).
 * Hiding items is UX only: every route re-checks permissions server-side.
 */
export function SidebarNav({
  allowedHrefs,
  onNavigate,
}: {
  allowedHrefs: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const allowed = new Set(allowedHrefs);
  const items: NavItem[] = NAV_ITEMS.filter((item) => allowed.has(item.href));

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-raised text-white"
                : "text-neutral-500 hover:bg-raised/60 hover:text-neutral-200",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-white" : "text-neutral-600 group-hover:text-neutral-400",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
