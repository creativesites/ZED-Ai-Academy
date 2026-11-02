"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LiveSessionTab } from "./LiveSessionTab";
import { NoticeBoardTab } from "./NoticeBoardTab";
import { TimetableTab } from "./TimetableTab";
import { DiscussionsTab } from "./DiscussionsTab";
import { StudentsTab } from "./StudentsTab";
import { GradebookTab } from "./GradebookTab";
import { GroupsTab } from "./GroupsTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { MessageSquare, Video, Calendar, Bell, Users, UsersRound, History, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabType = "session" | "timetable" | "noticeboard" | "discussions" | "students" | "gradebook" | "groups" | "history";

interface ClassroomTabsProps {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
  initialTab?: string;
}

const TABS: { id: TabType; label: string; icon: typeof Video; instructorOnly?: boolean }[] = [
  { id: "session", label: "Live", icon: Video },
  { id: "timetable", label: "Schedule", icon: Calendar },
  { id: "noticeboard", label: "Notices", icon: Bell },
  { id: "discussions", label: "Chat", icon: MessageSquare },
  { id: "students", label: "Students", icon: Users, instructorOnly: true },
  { id: "gradebook", label: "Gradebook", icon: GraduationCap, instructorOnly: true },
  { id: "groups", label: "Groups", icon: UsersRound, instructorOnly: true },
  { id: "history", label: "History", icon: History, instructorOnly: true },
];

export function ClassroomTabs({ companyId, isAdminOrInstructor, companySlug, initialTab }: ClassroomTabsProps) {
  const visibleTabs = TABS.filter((t) => !t.instructorOnly || isAdminOrInstructor);

  // An unknown tab, or an instructor-only tab opened by a student, falls back to "session"
  // instead of rendering an empty panel.
  const resolveTab = useCallback(
    (value?: string): TabType => (visibleTabs.find((t) => t.id === value)?.id ?? "session"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdminOrInstructor]
  );

  const [activeTab, setActiveTab] = useState<TabType>(() => resolveTab(initialTab));
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(resolveTab(initialTab));
  }, [initialTab, resolveTab]);

  // Keep the active pill in view on narrow screens.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeTab]);

  const selectTab = (id: TabType) => {
    setActiveTab(id);
    // Reflect the tab in the URL so refresh / share / back-from-another-page keep the place.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      if (id !== "session") url.searchParams.delete("scheduleId");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* non-browser environments: ignore */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = visibleTabs.length - 1;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next >= 0) {
      e.preventDefault();
      selectTab(visibleTabs[next].id);
      document.getElementById(`classroom-tab-${visibleTabs[next].id}`)?.focus();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
      {/* Desktop: vertical sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex-col gap-2 sticky top-24 h-fit">
        <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Classroom Tools</h3>
        <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-2">
          {visibleTabs.map((tab, i) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`classroom-tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls="classroom-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  isActive
                    ? "bg-brand text-brand-on shadow-lg shadow-brand/30"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile / tablet: scrollable pill strip that sticks under the site header */}
      <div className="lg:hidden sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-50/90 backdrop-blur border-b border-slate-200/70">
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Classroom sections"
          className="flex gap-2 overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleTabs.map((tab, i) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`classroom-tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls="classroom-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "snap-start shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-full text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  isActive
                    ? "bg-brand text-brand-on shadow-md shadow-brand/25"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main
        id="classroom-panel"
        role="tabpanel"
        aria-labelledby={`classroom-tab-${activeTab}`}
        className="flex-1 min-w-0 flex flex-col bg-white rounded-[1.5rem] lg:rounded-[2.5rem] shadow-xl lg:shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden min-h-[70vh] lg:min-h-[700px]"
      >
        <div className="flex-1 flex flex-col relative min-h-0">
          {activeTab === "session" && (
            <LiveSessionTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "timetable" && (
            <TimetableTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "noticeboard" && (
            <NoticeBoardTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "discussions" && <DiscussionsTab companyId={companyId} companySlug={companySlug} />}
          {activeTab === "students" && isAdminOrInstructor && (
            <StudentsTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
              onViewPerformance={() => selectTab("gradebook")}
            />
          )}
          {activeTab === "gradebook" && isAdminOrInstructor && <GradebookTab companyId={companyId} companySlug={companySlug} />}
          {activeTab === "groups" && isAdminOrInstructor && <GroupsTab companyId={companyId} companySlug={companySlug} />}
          {activeTab === "history" && isAdminOrInstructor && <SessionHistoryTab companyId={companyId} />}
        </div>
      </main>
    </div>
  );
}
