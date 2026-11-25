"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type StudioTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number | null;
  content: ReactNode;
};

/**
 * Lightweight URL-synced tabs for the course studio.
 * The active tab lives in `?tab=` so refreshes, back-navigation from the lesson
 * editor and shared links land on the same panel. Panels stay mounted (hidden)
 * so in-progress edits in one tab survive switching to another.
 */
export function StudioTabs({ tabs, defaultTab }: { tabs: StudioTab[]; defaultTab: string }) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [active, setActive] = useState(() =>
    urlTab && tabs.some((t) => t.id === urlTab) ? urlTab : defaultTab
  );

  // Follow in-app links such as "?tab=details" from the launch checklist.
  const [syncedUrlTab, setSyncedUrlTab] = useState(urlTab);
  if (syncedUrlTab !== urlTab) {
    setSyncedUrlTab(urlTab);
    if (urlTab && tabs.some((t) => t.id === urlTab)) setActive(urlTab);
  }

  const select = useCallback((id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === defaultTab) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [defaultTab]);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-b border-slate-200/80 bg-slate-50/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 sm:mx-0 sm:px-0">
        <nav
          role="tablist"
          aria-label="Course studio sections"
          className="no-scrollbar flex gap-1 overflow-x-auto py-2"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`studio-panel-${tab.id}`}
                id={`studio-tab-${tab.id}`}
                onClick={() => select(tab.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors",
                  isActive
                    ? "bg-ink text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-ink"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && tab.badge !== "" && (
                  <span
                    className={cn(
                      "ml-0.5 rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums",
                      isActive ? "bg-white/15 text-white" : "bg-slate-200/70 text-slate-600"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {tabs.map((tab) => (
        <section
          key={tab.id}
          role="tabpanel"
          id={`studio-panel-${tab.id}`}
          aria-labelledby={`studio-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="pt-5 sm:pt-6"
        >
          {tab.content}
        </section>
      ))}
    </div>
  );
}
