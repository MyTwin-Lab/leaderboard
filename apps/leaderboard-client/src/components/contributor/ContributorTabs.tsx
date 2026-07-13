"use client";

import { useState } from "react";

interface TabItem {
  label: string;
  panel: React.ReactNode;
}

export function ContributorTabs({ tabs, initialTab }: { tabs: TabItem[]; initialTab?: string }) {
  const [active, setActive] = useState(() => {
    if (!initialTab) return 0;
    const idx = tabs.findIndex(t => t.label.toLowerCase() === initialTab.toLowerCase());
    return idx >= 0 ? idx : 0;
  });

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex overflow-x-auto border-b border-white/10">
        {tabs.map((tab, i) => {
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`group relative shrink-0 px-4 py-2.5 font-medium transition-all duration-200 focus-visible:outline-none ${
                isActive
                  ? "text-[15px] text-white"
                  : "text-[13px] text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}

              {/* Underline — always rendered, slides via scaleX */}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-full bg-brandCP transition-transform duration-250 ${
                  isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Active panel — fade in on tab change */}
      <div key={active} className="animate-fade-up">
        {tabs[active].panel}
      </div>
    </div>
  );
}
