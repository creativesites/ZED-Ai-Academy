"use client";

import { useState, useEffect } from "react";
import { LiveSessionTab } from "./LiveSessionTab";
import { NoticeBoardTab } from "./NoticeBoardTab";
import { TimetableTab } from "./TimetableTab";
import { MaterialsTab } from "./MaterialsTab";
import { AssignmentsTab } from "./AssignmentsTab";
import { DiscussionsTab } from "./DiscussionsTab";
import { StudentsTab } from "./StudentsTab";
import { GradebookTab } from "./GradebookTab";
import { GroupsTab } from "./GroupsTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import {
  MessageSquare,
  Video,
  Calendar,
  Bell,
  Users,
  UsersRound,
  History,
  GraduationCap,
  FolderOpen,
  FileCheck2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClassroomGroups, getCompanyCourses } from "@/actions/classroom";
import { cn } from "@/lib/utils";

type TabType =
  | "session"
  | "timetable"
  | "materials"
  | "assignments"
  | "noticeboard"
  | "discussions"
  | "students"
  | "gradebook"
  | "groups"
  | "history";

interface ClassroomTabsProps {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
  initialTab?: TabType;
}

export function ClassroomTabs({
  companyId,
  isAdminOrInstructor,
  companySlug,
  initialTab = "session",
}: ClassroomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string>("all");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsData, coursesData] = await Promise.all([
          getClassroomGroups(companyId),
          getCompanyCourses(companyId),
        ]);
        setCohorts(groupsData || []);
        setCourses(coursesData || []);
      } catch (err) {
        console.error("Failed to load classroom cohorts/courses:", err);
      }
    }
    loadData();
  }, [companyId]);

  const tabs = [
    { id: "session" as const, label: "Live", icon: Video },
    { id: "timetable" as const, label: "Schedule", icon: Calendar },
    { id: "materials" as const, label: "Materials", icon: FolderOpen },
    { id: "assignments" as const, label: "Assignments", icon: FileCheck2 },
    { id: "noticeboard" as const, label: "Notices", icon: Bell },
    { id: "discussions" as const, label: "Chat", icon: MessageSquare },
    { id: "students" as const, label: "Students", icon: Users, instructorOnly: true },
    { id: "gradebook" as const, label: "Gradebook", icon: GraduationCap, instructorOnly: true },
    { id: "groups" as const, label: "Cohorts", icon: UsersRound, instructorOnly: true },
    { id: "history" as const, label: "History", icon: History, instructorOnly: true },
  ];

  const filteredTabs = tabs.filter((tab) => !tab.instructorOnly || isAdminOrInstructor);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 pb-24 lg:pb-0">
      {/* 
        Desktop Sidebar: Visible only on lg screens 
      */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex-col gap-4 sticky top-4 h-fit">
        {/* Cohort / Section Selector */}
        {cohorts.length > 0 && (
          <div className="pb-3 border-b border-slate-100">
            <label className="px-2 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
              Active Cohort
            </label>
            <Select value={activeCohortId} onValueChange={(v) => setActiveCohortId(v ?? "all")}>
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                <SelectValue placeholder="All Cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">
                  All Cohorts (Institution)
                </SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
            Classroom Tools
          </h3>
          <div className="space-y-1">
            {filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3.5 px-5 py-3.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all w-full",
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
          </div>
        </div>
      </aside>

      {/* 
        Mobile Bottom Navigation: Fixed to bottom on small screens 
      */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white/90 backdrop-blur-lg border border-slate-200 shadow-2xl rounded-3xl px-2 py-3">
        <div className="flex justify-around items-center max-w-md mx-auto overflow-x-auto">
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 flex-1 min-w-[50px]"
              >
                <div
                  className={cn(
                    "p-2 rounded-2xl transition-all",
                    isActive ? "bg-[#fd5523] text-white" : "text-slate-400"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold truncate w-full text-center px-0.5",
                    isActive ? "text-[#fd5523]" : "text-slate-400"
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden min-h-[80vh] lg:min-h-[700px]">
        <div className="p-1 flex-1 flex flex-col relative min-h-0">
          {activeTab === "session" && (
            <LiveSessionTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
            />
          )}
          {activeTab === "timetable" && (
            <TimetableTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
            />
          )}
          {activeTab === "materials" && (
            <MaterialsTab
              companyId={companyId}
              companySlug={companySlug}
              isAdminOrInstructor={isAdminOrInstructor}
              cohorts={cohorts}
              activeCohortId={activeCohortId === "all" ? null : activeCohortId}
            />
          )}
          {activeTab === "assignments" && (
            <AssignmentsTab
              companyId={companyId}
              companySlug={companySlug}
              isAdminOrInstructor={isAdminOrInstructor}
              selectedCohortId={activeCohortId}
              cohorts={cohorts}
              courses={courses}
            />
          )}
          {activeTab === "noticeboard" && (
            <NoticeBoardTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
            />
          )}
          {activeTab === "discussions" && (
            <DiscussionsTab
              companyId={companyId}
              companySlug={companySlug}
              isAdminOrInstructor={isAdminOrInstructor}
              selectedCohortId={activeCohortId}
              cohorts={cohorts}
            />
          )}
          {activeTab === "students" && isAdminOrInstructor && (
            <StudentsTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
              onViewPerformance={() => setActiveTab("gradebook")}
            />
          )}
          {activeTab === "gradebook" && isAdminOrInstructor && (
            <GradebookTab companyId={companyId} companySlug={companySlug} />
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
