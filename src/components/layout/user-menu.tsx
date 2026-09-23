"use client";

import Link from "next/link";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";

export interface SessionUser {
  id: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  status: string;
  serverNumber: number;
}

export function UserMenu({
  user,
  roleName,
  unread,
}: {
  user: SessionUser;
  roleName?: string;
  unread: number;
}) {
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/notifications"
        aria-label={`Notifications (${unread} unread)`}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-raised text-neutral-400 transition-colors hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>

      <Dropdown
        trigger={
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-md border border-line bg-raised px-1.5 py-1 transition-colors hover:border-line2"
          >
            <Avatar src={user.avatarUrl} name={user.nickname ?? user.displayName} size={22} />
            <span className="hidden max-w-[140px] truncate text-[13px] text-neutral-200 sm:block">
              {user.nickname ?? user.displayName}
            </span>
          </button>
        }
      >
        {(close) => (
          <>
            <DropdownLabel>
              {roleName ?? "Player"} · Server #{user.serverNumber}
            </DropdownLabel>
            <Link href={`/users/${user.id}`} onClick={close}>
              <DropdownItem>
                <User className="h-3.5 w-3.5" /> Profile
              </DropdownItem>
            </Link>
            <Link href="/settings" onClick={close}>
              <DropdownItem>
                <Settings className="h-3.5 w-3.5" /> Settings
              </DropdownItem>
            </Link>
            <DropdownSeparator />
            <DropdownItem danger onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownItem>
          </>
        )}
      </Dropdown>
    </div>
  );
}
