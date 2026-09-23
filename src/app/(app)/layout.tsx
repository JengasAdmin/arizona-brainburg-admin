import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAuth } from "@/server/auth/access";
import { NAV_ITEMS } from "@/lib/nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchBox } from "@/components/layout/search-box";
import { UserMenu } from "@/components/layout/user-menu";
import { SERVER_LABEL } from "@/lib/constants";
import { unreadCount } from "@/server/services/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/?error=session_expired");

  const allowedHrefs = NAV_ITEMS.filter(
    (item) => !item.permission || auth.permissions.has(item.permission),
  ).map((item) => item.href);
  const unread = await unreadCount(auth.user.id);
  const primaryRole = [...auth.actor.roles].sort((a, b) => b.level - a.level)[0];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 border-b border-line px-4 py-4"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line2 bg-raised">
            <ShieldCheck className="h-4 w-4 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-white">ARIZONA RP</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600">
              Brainburg · {SERVER_LABEL}
            </span>
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
            Навигация
          </div>
          <SidebarNav allowedHrefs={allowedHrefs} />
        </div>

        <div className="border-t border-line px-4 py-3">
          <div className="truncate text-[11px] text-neutral-600">
            {primaryRole?.name ?? "Игрок"}
          </div>
          <div className="truncate text-xs text-neutral-300">
            {auth.user.nickname ?? auth.user.displayName}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <MobileNav allowedHrefs={allowedHrefs} />
          <div className="hidden min-w-0 flex-1 sm:block">
            <SearchBox />
          </div>
          <div className="flex-1 sm:hidden" />
          <UserMenu
            user={{
              id: auth.user.id,
              displayName: auth.user.displayName,
              nickname: auth.user.nickname,
              avatarUrl: auth.user.avatarUrl,
              status: auth.user.status,
              serverNumber: auth.user.serverNumber,
            }}
            roleName={primaryRole?.name}
            unread={unread}
          />
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5">{children}</main>

        <footer className="border-t border-line px-4 py-3 text-[11px] text-neutral-700">
          ARIZONA RP — BRAINBURG · {SERVER_LABEL} · Платформа администрирования
        </footer>
      </div>
    </div>
  );
}
