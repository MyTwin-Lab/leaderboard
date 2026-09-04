"use client";

import { useState } from "react";
import { TabPills } from "@/components/ui/TabPills";

interface TabItem {
  label: string;
  panel: React.ReactNode;
}

export function ContributorTabs({ tabs, initialTab, extra }: { tabs: TabItem[]; initialTab?: string; extra?: React.ReactNode }) {
  const [active, setActive] = useState(() => {
    if (!initialTab) return 0;
    const idx = tabs.findIndex(t => t.label.toLowerCase() === initialTab.toLowerCase());
    return idx >= 0 ? idx : 0;
  });

  return (
    <div>
      <TabPills tabs={tabs} active={active} onChange={setActive} className="mb-6" />

      {/* Content shared across every tab — meetings, in the redesign */}
      {extra && <div className="mb-6">{extra}</div>}

      {/* Active panel — fade in on tab change */}
      <div key={active} className="animate-fade-up">
        {tabs[active].panel}
      </div>
    </div>
  );
}
