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
  initialTab?: string;
  initialCohortId?: string;
}

const VALID_CLASSROOM_TABS = new Set<TabType>([
  "overview",
  "session",
  "timetable",
  "materials",
  "assignments",
  "noticeboard",
  "discussions",
  "progress",
  "students",
  "gradebook",
  "groups",
  "history",
]);

function normalizeClassroomTab(raw?: string): TabType {
  if (!raw) return "overview";
  const lower = raw.toLowerCase();
  if (lower === "announcements" || lower === "notices") return "noticeboard";
  if (lower === "schedule") return "timetable";
  if (lower === "documents") return "materials";
  if (lower === "live") return "session";
  return VALID_CLASSROOM_TABS.has(lower as TabType) ? (lower as TabType) : "overview";
}

export function ClassroomTabs({
  companyId,
  isAdminOrInstructor,
  companySlug,
  initialTab = "overview",
  initialCohortId,
}: ClassroomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => normalizeClassroomTab(initialTab));
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string>(initialCohortId || "all");
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
      setActiveTab(normalizeClassroomTab(initialTab));
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
    { id: "groups" as const, label: "Classes & Courses", icon: UsersRound, instructorOnly: true },
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
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 pb-20 lg:pb-0">
      {/*
        Mobile Top Controls: Cohort Switcher + Sticky Horizontal Pill Rail
      */}
      <div className="lg:hidden flex flex-col gap-2.5 sticky top-16 z-30 bg-slate-50/95 backdrop-blur-md -mx-3 px-3 py-2 border-b border-slate-200/70">
        {cohorts.length > 0 && (
          <div className="bg-white rounded-xl px-3 py-2 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-[#062e39] text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                {selectedCohort?.name ? selectedCohort.name.charAt(0) : "C"}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 block leading-none">
                  Class / Cohort
                </span>
                <p className="text-xs font-bold text-[#062e39] truncate mt-0.5">
                  {activeCohortId === "all" ? "All Classes" : selectedCohort?.name || "All Classes"}
                </p>
              </div>
            </div>

            <Select value={activeCohortId} onValueChange={(v) => setActiveCohortId(v ?? "all")}>
              <SelectTrigger className="h-8 px-2.5 w-auto max-w-[150px] rounded-lg bg-slate-50 border-slate-200 text-[11px] font-semibold text-slate-700 shrink-0">
                <SelectValue placeholder="Switch" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-xs font-semibold">
                  All Classes
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

        <div className="overflow-x-auto scrollbar-none flex items-center gap-1.5 touch-pan-x pb-0.5">
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMoreOpen(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all min-h-[36px] cursor-pointer",
                  isActive
                    ? "bg-[#fd5523] text-white shadow-xs"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-100"
                )}
              >
                <tab.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        Desktop Sidebar: Slim modern navigation rail
      */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/80 flex-col gap-3 sticky top-20 h-fit">
        {cohorts.length > 0 && (
          <div className="pb-2.5 border-b border-slate-100">
            <label className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Active Class
            </label>
            <Select value={activeCohortId} onValueChange={(v) => setActiveCohortId(v ?? "all")}>
              <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold text-slate-700">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-semibold">
                  All Classes
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
          <h3 className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Workspace
          </h3>
          <div className="space-y-0.5">
            {filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all w-full cursor-pointer text-left",
                    isActive
                      ? "bg-[#fd5523] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#062e39]"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/*
        Mobile Bottom Navigation Bar: Compact, crisp thumb navigation
      */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMoreOpen(false);
                }}
                className="flex flex-col items-center gap-0.5 flex-1 py-1 min-h-[44px] justify-center cursor-pointer min-w-0"
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    isActive ? "bg-[#fd5523] text-white" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold truncate max-w-full px-0.5 text-center leading-tight",
                    isActive ? "text-[#fd5523]" : "text-slate-500"
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMobileMoreOpen((prev) => !prev)}
            className="flex flex-col items-center gap-0.5 flex-1 py-1 min-h-[44px] justify-center cursor-pointer min-w-0"
          >
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all relative",
                isMoreTabActive || isMobileMoreOpen
                  ? "bg-[#062e39] text-white"
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
                "text-[10px] font-semibold truncate text-center leading-tight",
                isMoreTabActive || isMobileMoreOpen ? "text-[#062e39]" : "text-slate-500"
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
          <div className="relative z-10 bg-white rounded-t-3xl p-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] shadow-2xl border-t border-slate-100 animate-in slide-in-from-bottom duration-300 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-sm font-bold text-[#062e39]">Classroom Tools</h4>
                <p className="text-[11px] text-slate-400">Collaborate, interact and track learning</p>
              </div>
              <button
                type="button"
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
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMoreOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all min-h-[52px] cursor-pointer min-w-0",
                      isActive
                        ? "bg-[#fd5523] text-white border-[#fd5523] shadow-sm"
                        : "bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-600 shadow-xs"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-semibold truncate", isActive ? "text-white" : "text-slate-800")}>
                        {tab.label}
                      </p>
                      <p className={cn("text-[10px] truncate", isActive ? "text-white/80" : "text-slate-400")}>
                        {tab.instructorOnly ? "Faculty" : "Classroom"}
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
      <main className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden min-h-[65dvh] lg:min-h-[680px]">
        <div className="flex-1 flex flex-col relative min-h-0 min-w-0">
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
              courses={courses}
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
