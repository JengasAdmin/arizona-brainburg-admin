"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";

export interface ProfileTab {
  key: string;
  label: string;
  badge?: number;
}

/**
 * Tab state container for the user profile page. Switching happens purely on
 * the client — every panel is fetched on the server and passed in as a slot.
 */
export function ProfileTabs({
  tabs,
  panels,
}: {
  tabs: ProfileTab[];
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "");

  return (
    <div className="mt-5">
      <Tabs
        items={tabs.map((tab) => ({ id: tab.key, label: tab.label, count: tab.badge }))}
        value={active}
        onChange={setActive}
      />
      <div className="mt-4">{panels[active] ?? null}</div>
    </div>
  );
}
