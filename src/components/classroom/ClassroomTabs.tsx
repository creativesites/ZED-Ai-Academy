"use client";

import { useState, useEffect } from "react";
import { OverviewTab } from "./OverviewTab";
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
  LayoutDashboard,
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
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClassroomGroups,
  getCompanyCourses,
  getCompanySessionState,
  getAnnouncements,
} from "@/actions/classroom";
import { getClassroomAssignments } from "@/actions/classroom-assignments";
import { getClassroomMaterials } from "@/actions/classroom-materials";
import { cn } from "@/lib/utils";

type TabType =
  | "overview"
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
  initialTab = "overview",
}: ClassroomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string>("all");
  const [sessionState, setSessionState] = useState<any>({ is_session_active: false, active_room_name: null, active_session_id: null });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsData, coursesData, sState, aNotices, aTasks, aDocs] = await Promise.all([
          getClassroomGroups(companyId),
          getCompanyCourses(companyId),
          getCompanySessionState(companyId, activeCohortId),
          getAnnouncements(companyId, activeCohortId),
          getClassroomAssignments(companyId, activeCohortId),
          getClassroomMaterials(companyId, { cohortId: activeCohortId }),
        ]);
        setCohorts(groupsData || []);
        setCourses(coursesData || []);
        setSessionState(sState || { is_session_active: false, active_room_name: null, active_session_id: null });
        setAnnouncements(aNotices || []);
        setAssignments(aTasks || []);
        setMaterials(aDocs || []);
      } catch (err) {
        console.error("Failed to load classroom dashboard data:", err);
      }
    }
    loadData();
  }, [companyId, activeCohortId]);

  const selectedCohort =
    activeCohortId !== "all" ? cohorts.find((c) => c.id === activeCohortId) : cohorts[0] || null;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "timetable" as const, label: "Schedule", icon: Calendar },
    { id: "materials" as const, label: "Documents", icon: FolderOpen },
    { id: "assignments" as const, label: "Assignments", icon: FileCheck2 },
    { id: "noticeboard" as const, label: "Notices", icon: Bell },
    { id: "discussions" as const, label: "Community", icon: MessageSquare },
    { id: "session" as const, label: "Live Room", icon: Video },
    { id: "students" as const, label: "Students", icon: Users, instructorOnly: true },
    { id: "gradebook" as const, label: "Gradebook", icon: GraduationCap, instructorOnly: true },
    { id: "groups" as const, label: "Cohorts", icon: UsersRound, instructorOnly: true },
    { id: "history" as const, label: "History", icon: History, instructorOnly: true },
  ];

  const filteredTabs = tabs.filter((tab) => !tab.instructorOnly || isAdminOrInstructor);

  // 4 Primary Mobile Tabs + More
  const mobilePrimaryTabIds: TabType[] = ["overview", "timetable", "materials", "assignments"];
  const mobilePrimaryTabs = filteredTabs.filter((t) => mobilePrimaryTabIds.includes(t.id));
  const mobileMoreTabs = filteredTabs.filter((t) => !mobilePrimaryTabIds.includes(t.id));
  const isMoreTabActive = mobileMoreTabs.some((t) => t.id === activeTab);

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
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white/95 backdrop-blur-lg border border-slate-200 shadow-2xl rounded-3xl px-3 py-2">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMoreOpen(false);
                }}
                className="flex flex-col items-center gap-1 flex-1 py-1"
              >
                <div
                  className={cn(
                    "p-2 rounded-2xl transition-all",
                    isActive ? "bg-[#fd5523] text-white shadow-md shadow-[#fd5523]/30" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold truncate text-center",
                    isActive ? "text-[#fd5523]" : "text-slate-400"
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More Menu Trigger */}
          <button
            onClick={() => setIsMobileMoreOpen((prev) => !prev)}
            className="flex flex-col items-center gap-1 flex-1 py-1"
          >
            <div
              className={cn(
                "p-2 rounded-2xl transition-all relative",
                isMoreTabActive || isMobileMoreOpen
                  ? "bg-[#062e39] text-white shadow-md"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              {isMoreTabActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#fd5523] ring-2 ring-white" />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-bold truncate text-center",
                isMoreTabActive || isMobileMoreOpen ? "text-[#062e39]" : "text-slate-400"
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer Modal */}
      {isMobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsMobileMoreOpen(false)}
          />

          {/* Bottom Sheet */}
          <div className="relative z-10 bg-white rounded-t-[2.5rem] p-6 pb-28 shadow-2xl border-t border-slate-100 animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-sm font-black text-[#062e39]">Additional Classroom Tools</h4>
                <p className="text-[11px] text-slate-400">Collaborate, interact and manage</p>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {mobileMoreTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMoreOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                      isActive
                        ? "bg-[#fd5523] text-white border-[#fd5523] shadow-md shadow-[#fd5523]/20"
                        : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-600 shadow-sm"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-black truncate", isActive ? "text-white" : "text-slate-800")}>
                        {tab.label}
                      </p>
                      <p className={cn("text-[9px] truncate", isActive ? "text-white/80" : "text-slate-400")}>
                        {tab.instructorOnly ? "Faculty Tool" : "Class Room"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden min-h-[80vh] lg:min-h-[700px]">
        <div className="p-1 flex-1 flex flex-col relative min-h-0">
          {activeTab === "overview" && (
            <div className="p-4 md:p-6">
              <OverviewTab
                companyId={companyId}
                companySlug={companySlug}
                isAdminOrInstructor={isAdminOrInstructor}
                selectedCohort={selectedCohort}
                sessionState={sessionState}
                onNavigateTab={(tab) => setActiveTab(tab as TabType)}
                courses={courses}
                announcements={announcements}
                assignments={assignments}
                materials={materials}
              />
            </div>
          )}
          {activeTab === "session" && (
            <LiveSessionTab
              companyId={companyId}
              isAdminOrInstructor={isAdminOrInstructor}
              companySlug={companySlug}
              activeCohortId={activeCohortId === "all" ? null : activeCohortId}
              cohorts={cohorts}
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
