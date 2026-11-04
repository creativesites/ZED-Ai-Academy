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
import { StudentProgressTab } from "./StudentProgressTab";
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
  Award,
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
  getClassSchedules,
  getMyClassroomProgress,
  getInstructorOverviewStats,
  getAcademyInstructors,
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
  | "progress"
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
  const [schedules, setSchedules] = useState<any[]>([]);
  const [studentProgress, setStudentProgress] = useState<any | null>(null);
  const [instructorStats, setInstructorStats] = useState<any | null>(null);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsData, coursesData, sState, aNotices, aTasks, aDocs, aSchedules] = await Promise.all([
          getClassroomGroups(companyId),
          getCompanyCourses(companyId),
          getCompanySessionState(companyId, activeCohortId),
          getAnnouncements(companyId, activeCohortId),
          getClassroomAssignments(companyId, activeCohortId),
          getClassroomMaterials(companyId, { cohortId: activeCohortId }),
          getClassSchedules(companyId),
        ]);
        setCohorts(groupsData || []);
        setCourses(coursesData || []);
        setSessionState(sState || { is_session_active: false, active_room_name: null, active_session_id: null });
        setAnnouncements(aNotices || []);
        setAssignments(aTasks || []);
        setMaterials(aDocs || []);
        setSchedules(aSchedules || []);

        // Load role-specific academic stats
        if (isAdminOrInstructor) {
          const stats = await getInstructorOverviewStats(companyId, activeCohortId);
          setInstructorStats(stats);
        } else {
          const [progress, faculty] = await Promise.all([
            getMyClassroomProgress(companyId, activeCohortId),
            getAcademyInstructors(companyId),
          ]);
          setStudentProgress(progress);
          setInstructors(faculty || []);
        }
      } catch (err) {
        console.error("Failed to load classroom dashboard data:", err);
      }
    }
    loadData();
  }, [companyId, activeCohortId, isAdminOrInstructor]);

  const selectedCohort =
    activeCohortId !== "all" ? cohorts.find((c) => c.id === activeCohortId) : cohorts[0] || null;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "timetable" as const, label: "Schedule", icon: Calendar },
    { id: "materials" as const, label: "Documents", icon: FolderOpen },
    { id: "assignments" as const, label: "Assignments", icon: FileCheck2 },
    { id: "noticeboard" as const, label: "Notices", icon: Bell },
    { id: "discussions" as const, label: "Community", icon: MessageSquare },
    { id: "progress" as const, label: "My Progress", icon: Award, learnerOnly: true },
    { id: "session" as const, label: "Live Room", icon: Video },
    { id: "students" as const, label: "Students", icon: Users, instructorOnly: true },
    { id: "gradebook" as const, label: "Gradebook", icon: GraduationCap, instructorOnly: true },
    { id: "groups" as const, label: "Cohorts", icon: UsersRound, instructorOnly: true },
    { id: "history" as const, label: "History", icon: History, instructorOnly: true },
  ];

  const filteredTabs = tabs.filter((tab) => {
    if (tab.instructorOnly && !isAdminOrInstructor) return false;
    if ((tab as any).learnerOnly && isAdminOrInstructor) return false;
    return true;
  });

  // 4 Primary Mobile Tabs + More
  const mobilePrimaryTabIds: TabType[] = ["overview", "timetable", "materials", "assignments"];
  const mobilePrimaryTabs = filteredTabs.filter((t) => mobilePrimaryTabIds.includes(t.id));
  const mobileMoreTabs = filteredTabs.filter((t) => !mobilePrimaryTabIds.includes(t.id));
  const isMoreTabActive = mobileMoreTabs.some((t) => t.id === activeTab);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 pb-24 lg:pb-0">
      {/* 
        Mobile Header Controls: Cohort Selector & Horizontal Tab Strip (Visible on mobile/tablet)
      */}
      <div className="lg:hidden flex flex-col gap-3">
        {/* Mobile Cohort / Section Selector */}
        {cohorts.length > 0 && (
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-[#062e39] text-white flex items-center justify-center shrink-0 text-xs font-black">
                {selectedCohort?.name ? selectedCohort.name.charAt(0) : "C"}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                  Active Cohort
                </span>
                <p className="text-xs font-black text-[#062e39] truncate">
                  {activeCohortId === "all" ? "All Cohorts (Institution)" : selectedCohort?.name || "Active Cohort"}
                </p>
              </div>
            </div>

            <Select value={activeCohortId} onValueChange={(v) => setActiveCohortId(v ?? "all")}>
              <SelectTrigger className="h-9 px-3 w-auto min-w-[120px] rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-700 shrink-0">
                <SelectValue placeholder="Switch Cohort" />
              </SelectTrigger>
              <SelectContent align="end">
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

        {/* Mobile Top Horizontal Scrollable Tab Bar */}
        <div className="-mx-1 px-1 overflow-x-auto scrollbar-none py-1 flex items-center gap-1.5 touch-pan-x">
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMoreOpen(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all min-h-[40px] cursor-pointer",
                  isActive
                    ? "bg-[#fd5523] text-white shadow-md shadow-[#fd5523]/25 scale-[1.02]"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
                )}
              >
                <tab.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
                    "flex items-center gap-3.5 px-5 py-3.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all w-full cursor-pointer",
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
        Mobile Bottom Navigation Dock: Fixed to bottom on small screens with iOS safe-area support
      */}
      <nav className="lg:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 sm:left-6 sm:right-6 z-40 bg-white/95 backdrop-blur-lg border border-slate-200 shadow-2xl rounded-2xl sm:rounded-3xl px-2 py-1.5 max-w-lg mx-auto">
        <div className="flex justify-between items-center">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMoreOpen(false);
                }}
                className="flex flex-col items-center gap-0.5 flex-1 py-1 min-h-[44px] justify-center cursor-pointer"
              >
                <div
                  className={cn(
                    "p-1.5 rounded-xl transition-all",
                    isActive ? "bg-[#fd5523] text-white shadow-md shadow-[#fd5523]/30" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold truncate text-center leading-tight",
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
            className="flex flex-col items-center gap-0.5 flex-1 py-1 min-h-[44px] justify-center cursor-pointer"
          >
            <div
              className={cn(
                "p-1.5 rounded-xl transition-all relative",
                isMoreTabActive || isMobileMoreOpen
                  ? "bg-[#062e39] text-white shadow-md"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              {isMoreTabActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#fd5523] ring-2 ring-white" />
              )}
            </div>
            <span
              className={cn(
                "text-[9px] font-bold truncate text-center leading-tight",
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
          <div className="relative z-10 bg-white rounded-t-[2rem] p-5 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] shadow-2xl border-t border-slate-100 animate-in slide-in-from-bottom duration-300 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-sm font-black text-[#062e39]">Classroom Tools</h4>
                <p className="text-[11px] text-slate-400">Collaborate, interact and track learning</p>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
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
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all min-h-[56px] cursor-pointer",
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
      <main className="flex-1 flex flex-col bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-xl sm:shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden min-h-[70dvh] lg:min-h-[700px]">
        <div className="p-0 sm:p-1 flex-1 flex flex-col relative min-h-0">
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
                schedules={schedules}
                studentProgress={studentProgress}
                instructorStats={instructorStats}
                instructors={instructors}
              />
            </div>
          )}
          {activeTab === "progress" && !isAdminOrInstructor && (
            <StudentProgressTab
              companyId={companyId}
              companySlug={companySlug}
              selectedCohortId={activeCohortId === "all" ? null : activeCohortId}
              courses={courses}
            />
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
