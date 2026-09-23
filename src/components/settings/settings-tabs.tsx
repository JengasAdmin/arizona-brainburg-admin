"use client";

import { useState, type ReactNode } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";

export interface SettingsTabDef {
  id: string;
  label: string;
}

export interface SettingsPanel {
  id: string;
  content: ReactNode;
}

/** Permission-gated tab strip for the Settings page (tabs are decided server-side). */
export function SettingsTabs({
  tabs,
  defaultTab,
  panels,
}: {
  tabs: SettingsTabDef[];
  defaultTab?: string;
  panels: SettingsPanel[];
}) {
  const [value, setValue] = useState(() =>
    defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id ?? "",
  );
  const active = panels.find((panel) => panel.id === value);
  const items: TabItem[] = tabs.map((tab) => ({ id: tab.id, label: tab.label }));

  return (
    <div>
      <Tabs items={items} value={value} onChange={setValue} className="mb-4" />
      {active ? <div key={active.id}>{active.content}</div> : null}
    </div>
  );
}
