"use client";

import { useState } from "react";
import { LiveSessionTab } from "./LiveSessionTab";
import { NoticeBoardTab } from "./NoticeBoardTab";
import { TimetableTab } from "./TimetableTab";
import { DiscussionsTab } from "./DiscussionsTab";
import { StudentsTab } from "./StudentsTab";
import { GroupsTab } from "./GroupsTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { MessageSquare, Video, Calendar, Bell, Users, UsersRound, History } from "lucide-react";
import { cn } from "@/lib/utils";

type TabType = "session" | "timetable" | "noticeboard" | "discussions" | "students" | "groups" | "history";

interface ClassroomTabsProps {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
}

export function ClassroomTabs({ companyId, isAdminOrInstructor, companySlug }: ClassroomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("session");

  const tabs = [
    { id: "session" as const, label: "Live", icon: Video }, // Shortened labels for mobile
    { id: "timetable" as const, label: "Schedule", icon: Calendar },
    { id: "noticeboard" as const, label: "Notices", icon: Bell },
    { id: "discussions" as const, label: "Chat", icon: MessageSquare },
    { id: "students" as const, label: "Students", icon: Users, instructorOnly: true },
    { id: "groups" as const, label: "Groups", icon: UsersRound, instructorOnly: true },
    { id: "history" as const, label: "History", icon: History, instructorOnly: true },
  ];

  const filteredTabs = tabs.filter(tab => !tab.instructorOnly || isAdminOrInstructor);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 pb-24 lg:pb-0">
      {/* 
        Desktop Sidebar: Visible only on lg screens 
      */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex-col gap-2 sticky top-4 h-fit">
        <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
          Classroom Tools
        </h3>
        {filteredTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all w-full",
                isActive
                  ? "bg-[#fd5523] text-white shadow-lg shadow-[#fd5523]/30 scale-[1.02]"
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <tab.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </aside>

      {/* 
        Mobile Bottom Navigation: Fixed to bottom on small screens 
      */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white/80 backdrop-blur-lg border border-slate-200 shadow-2xl rounded-3xl px-2 py-3">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 flex-1 min-w-0"
              >
                <div className={cn(
                  "p-2 rounded-2xl transition-all",
                  isActive ? "bg-[#fd5523] text-white" : "text-slate-400"
                )}>
                  <tab.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-bold truncate w-full text-center px-1",
                  isActive ? "text-[#fd5523]" : "text-slate-400"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden min-h-[80vh] lg:min-h-[700px]">
        <div className="p-1 flex-1 flex flex-col relative min-h-0"> {/* Slight wrapper to prevent content touching rounded edges */}
          {activeTab === "session" && (
            <LiveSessionTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "timetable" && (
            <TimetableTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "noticeboard" && (
            <NoticeBoardTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "discussions" && (
            <DiscussionsTab companyId={companyId} companySlug={companySlug} />
          )}
          {activeTab === "students" && isAdminOrInstructor && (
            <StudentsTab companyId={companyId} isAdminOrInstructor={isAdminOrInstructor} companySlug={companySlug} />
          )}
          {activeTab === "groups" && isAdminOrInstructor && (
            <GroupsTab companyId={companyId} companySlug={companySlug} />
          )}
          {activeTab === "history" && isAdminOrInstructor && (
            <SessionHistoryTab companyId={companyId} />
          )}
        </div>
      </main>
    </div>
  );
}