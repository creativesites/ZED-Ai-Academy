"use client";

import { useState } from "react";
import { LiveSessionTab } from "./LiveSessionTab";
import { NoticeBoardTab } from "./NoticeBoardTab";
import { TimetableTab } from "./TimetableTab";
import { DiscussionsTab } from "./DiscussionsTab";
import { StudentsTab } from "./StudentsTab";
import { GroupsTab } from "./GroupsTab";
import { MessageSquare, Video, Calendar, Bell, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

type TabType = "session" | "timetable" | "noticeboard" | "discussions" | "students" | "groups";

interface ClassroomTabsProps {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
}

export function ClassroomTabs({ companyId, isAdminOrInstructor, companySlug }: ClassroomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("session");

  const tabs = [
    { id: "session" as const, label: "Live Session", icon: Video },
    { id: "timetable" as const, label: "Timetable", icon: Calendar },
    { id: "noticeboard" as const, label: "Notice Board", icon: Bell },
    { id: "discussions" as const, label: "Discussions", icon: MessageSquare },
    { id: "students" as const, label: "Students", icon: Users, instructorOnly: true },
    { id: "groups" as const, label: "Groups", icon: UsersRound, instructorOnly: true },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col lg:flex-row gap-6">
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 shrink-0 bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
        <h3 className="px-4 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Classroom Tools</h3>
        {tabs.map((tab) => {
          if (tab.instructorOnly && !isAdminOrInstructor) return null;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all",
                isActive
                  ? "bg-[#fd5523]/10 text-[#fd5523]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive ? "text-[#fd5523]" : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
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
          <GroupsTab companyId={companyId} />
        )}
      </div>
    </div>
  );
}
