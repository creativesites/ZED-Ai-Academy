"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  Users,
  BookOpen,
  Settings,
  Plus,
  Play,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Loader2,
  Save,
  Clock,
  CheckCircle2,
  Mic,
  ExternalLink,
  BarChart3,
  CalendarPlus,
  Flag,
  Share2,
  MessageSquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonaStudio } from "./PersonaStudio";
import { ScenarioEditorModal } from "./ScenarioEditorModal";
import { TeacherInsightsPanel } from "./TeacherInsightsPanel";
import { SessionReviewDrawerModal } from "./SessionReviewDrawerModal";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { TUTOR_STYLE_LABELS } from "@/lib/tutor/tutor-session-block";
import { extractReportAverageScore, speakingMsToMinutes } from "@/lib/classroom/speaking-metrics";
import {
  createTutorAssignment,
  deleteScenario,
  deleteTutorAssignment,
  updateScenarioQuick,
  upsertTutorSettings,
  type PersonaRecord,
  type ScenarioRecord,
  type StaffTutorSessionSummary,
  type TeacherSessionReview,
  type TenantAiUsageSummary,
  type TutorAssignmentSummary,
  type TutorSettingsRecord,
} from "@/actions/tutor-authoring";

export function TutorStudioHub({
  companyId,
  companyName,
  companySlug,
  initialPersonas,
  initialScenarios,
  initialSettings,
  initialSessions,
  initialAssignments = [],
  classroomGroups = [],
  aiUsage = null,
}: {
  companyId: string;
  companyName: string;
  companySlug: string;
  initialPersonas: PersonaRecord[];
  initialScenarios: ScenarioRecord[];
  initialSettings: TutorSettingsRecord;
  initialSessions: StaffTutorSessionSummary[];
  initialAssignments?: TutorAssignmentSummary[];
  classroomGroups?: Array<{ id: string; name: string }>;
  aiUsage?: TenantAiUsageSummary | null;
}) {
  const [personas, setPersonas] = useState<PersonaRecord[]>(initialPersonas);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>(initialScenarios);
  const [settings, setSettings] = useState<TutorSettingsRecord>(initialSettings);
  const [sessions, setSessions] = useState<StaffTutorSessionSummary[]>(initialSessions);
  const [sessionFilter, setSessionFilter] = useState<"all" | "flagged" | "shared" | "reviewed">("all");
  const [reviewingSessionId, setReviewingSessionId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<TutorAssignmentSummary[]>(initialAssignments);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioRecord | null>(null);
  const [assignScenario, setAssignScenario] = useState<ScenarioRecord | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<string>("");
  const [assignDueAt, setAssignDueAt] = useState<string>("");

  const [isBusy, startBusy] = useTransition();

  const flaggedSessionsCount = sessions.filter((s) => s.status === "flagged").length;
  const filteredSessions = sessions.filter((sess) => {
    if (sessionFilter === "flagged") return sess.status === "flagged";
    if (sessionFilter === "shared") return sess.shared_with_teacher;
    if (sessionFilter === "reviewed") return Boolean(sess.has_teacher_review);
    return true;
  });

  function handleSessionReviewed(
    sessionId: string,
    updates: { status: string; teacher_review: TeacherSessionReview | null },
  ) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: updates.status,
              has_teacher_review: Boolean(updates.teacher_review),
              teacher_review_notes: updates.teacher_review?.notes ?? null,
              teacher_reviewed_at: updates.teacher_review?.reviewed_at ?? null,
            }
          : s,
      ),
    );
  }

  function handleAssignSubmit() {
    if (!assignScenario) return;
    startBusy(async () => {
      try {
        const created = await createTutorAssignment({
          companyId,
          scenarioId: assignScenario.id,
          groupId: assignGroupId || null,
          dueAt: assignDueAt || null,
        });
        setAssignments((prev) => [created, ...prev]);
        setAssignScenario(null);
        setAssignGroupId("");
        setAssignDueAt("");
        toast.success(`Assigned "${created.scenario_title}" to ${created.group_name ?? "whole academy"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not assign scenario");
      }
    });
  }

  function handleDeleteAssignment(assignmentId: string) {
    startBusy(async () => {
      try {
        await deleteTutorAssignment(companyId, assignmentId);
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        toast.success("Assignment removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove assignment");
      }
    });
  }

  function openNewScenario() {
    setEditingScenario(null);
    setEditorOpen(true);
  }

  function openEditScenario(s: ScenarioRecord) {
    setEditingScenario(s);
    setEditorOpen(true);
  }

  function handleScenarioSaved(saved: ScenarioRecord) {
    setScenarios((prev) =>
      prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...prev]
    );
  }

  function toggleStatus(s: ScenarioRecord) {
    const nextStatus = s.status === "published" ? "draft" : "published";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { status: nextStatus });
        handleScenarioSaved(updated);
        toast.success(nextStatus === "published" ? "Scenario published" : "Moved to draft");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  function toggleLibraryVisibility(s: ScenarioRecord) {
    const nextVis = s.visibility === "tenant_library" ? "course" : "tenant_library";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { visibility: nextVis });
        handleScenarioSaved(updated);
        toast.success(
          nextVis === "tenant_library"
            ? "Added to the academy Teacher's Room"
            : "Restricted to Course lessons only"
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update visibility");
      }
    });
  }

  function handleDeleteScenario(s: ScenarioRecord) {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    startBusy(async () => {
      try {
        await deleteScenario(companyId, s.id);
        setScenarios((prev) => prev.filter((x) => x.id !== s.id));
        toast.success("Scenario deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete scenario");
      }
    });
  }

  function handleSaveSettings() {
    startBusy(async () => {
      try {
        const saved = await upsertTutorSettings({
          companyId,
          practiceRoomEnabled: settings.practice_room_enabled,
          freePracticeMinutesPerMonth: settings.free_practice_minutes_per_month,
          allowedModes: settings.allowed_modes.length > 0 ? settings.allowed_modes : ["voice", "text"],
          enabledPersonaIds: settings.enabled_persona_ids,
          defaultPersonaId: settings.default_persona_id ?? null,
        });
        setSettings(saved);
        toast.success("Academy AI Tutor settings saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save settings");
      }
    });
  }

  function toggleMode(mode: "voice" | "text" | "live") {
    setSettings((prev) => {
      const has = prev.allowed_modes.includes(mode);
      const next = has
        ? prev.allowed_modes.filter((m) => m !== mode)
        : [...prev.allowed_modes, mode];
      return { ...prev, allowed_modes: next.length > 0 ? next : [mode] };
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6ee] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#fd5523]">
            <Sparkles className="h-3.5 w-3.5" />
            AI Teacher Studio
          </span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#062e39] sm:text-3xl">
            {companyName} — AI Teachers &amp; Flows
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Design your academy&apos;s animated AI teachers, build teaching flows for any subject, and manage the Teacher&apos;s Room.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/academy/${companySlug}/practice`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-[#062e39] shadow-sm hover:bg-slate-50"
          >
            <Mic className="h-3.5 w-3.5 text-[#fd5523]" />
            Open Teacher&apos;s Room
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="personas">
        <TabsList className="mb-6 inline-flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-[#062e39]/5 p-1">
          <TabsTrigger
            value="personas"
            className="h-10 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
          >
            <Users className="mr-1.5 h-4 w-4 text-[#fd5523]" />
            AI Teachers ({personas.length})
          </TabsTrigger>
          <TabsTrigger
            value="scenarios"
            className="h-10 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
          >
            <BookOpen className="mr-1.5 h-4 w-4 text-[#fd5523]" />
            Scenario Library ({scenarios.length})
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className="h-10 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
          >
            <BarChart3 className="mr-1.5 h-4 w-4 text-[#fd5523]" />
            Insights &amp; Misconceptions
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="h-10 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
          >
            <Settings className="mr-1.5 h-4 w-4 text-[#fd5523]" />
            Settings &amp; Review Queue ({sessions.length})
            {flaggedSessionsCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">
                {flaggedSessionsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Personas */}
        <TabsContent value="personas" className="mt-0">
          <PersonaStudio
            companyId={companyId}
            initialPersonas={personas}
            onPersonasChange={setPersonas}
          />
        </TabsContent>

        {/* TAB 2: Scenario Library */}
        <TabsContent value="scenarios" className="mt-0 space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#062e39]">AI Teacher Flows</h2>
              <p className="text-xs text-slate-500">
                Published flows marked &quot;Teacher&apos;s Room&quot; appear for learners in your academy&apos;s Teacher&apos;s Room and can be added to any lesson.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={openNewScenario}
              className="rounded-xl bg-[#fd5523] text-xs font-bold text-white hover:bg-[#ea4817]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Scenario
            </Button>
          </div>

          {scenarios.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-[#fd5523]" />
              <h3 className="mt-3 text-base font-bold text-[#062e39]">No AI Teacher flows yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                Create your first interactive role-play, guided lesson, or oral check with your animated AI teachers.
              </p>
              <Button
                type="button"
                onClick={openNewScenario}
                className="mt-4 rounded-xl bg-[#fd5523] font-bold text-white hover:bg-[#ea4817]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create First Scenario
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {scenarios.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a1338] to-[#321b4e]">
                      <Teacher
                        variant="bust"
                        persona={s.persona?.look ?? DEFAULT_PERSONA_LOOK}
                        className="h-16 w-16"
                        label={s.persona?.display_name ?? s.persona?.name ?? "AI Teacher"}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            s.status === "published"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {s.status}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {TUTOR_STYLE_LABELS[s.style]}
                        </span>
                        {s.level && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {s.level}
                          </span>
                        )}
                      </div>
                      <h3 className="truncate text-sm font-bold text-[#062e39]">{s.title}</h3>
                      <p className="line-clamp-2 text-xs text-slate-500">{s.goal}</p>
                      <p className="text-[11px] text-slate-400">
                        {s.persona ? `${s.persona.display_name || s.persona.name} · ` : ""}
                        {s.max_minutes} min · {s.beats.length} beats · {s.target_items.length} cards
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleStatus(s)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {s.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleLibraryVisibility(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {s.visibility === "tenant_library" ? (
                          <>
                            <Globe className="h-3 w-3 text-emerald-600" /> Teacher&apos;s Room
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 text-slate-400" /> Course Only
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {s.status === "published" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignScenario(s)}
                          className="h-8 rounded-lg px-2.5 text-xs font-bold text-[#062e39]"
                        >
                          <CalendarPlus className="mr-1 h-3 w-3 text-[#fd5523]" />
                          Assign
                        </Button>
                      )}
                      {s.status === "published" && (s.visibility === "tenant_library" || s.visibility === "platform") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              void navigator.clipboard?.writeText(`${window.location.origin}/try/${s.id}`);
                              toast.success("Public mini-lesson link copied (/try/...)!");
                            }
                          }}
                          title="Copy shareable public mini-lesson link"
                          className="h-8 rounded-lg px-2.5 text-xs font-bold text-[#062e39]"
                        >
                          <Share2 className="mr-1 h-3 w-3 text-[#fd5523]" />
                          Share
                        </Button>
                      )}
                      <Link
                        href={
                          companySlug
                            ? `/academy/${companySlug}/practice/${s.id}?back=${encodeURIComponent(`/academy/${companySlug}/admin/ai-teachers`)}`
                            : `/practice/${s.id}?back=${encodeURIComponent("/creator/ai-teachers")}`
                        }
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-xs font-bold shadow-xs transition hover:bg-accent hover:text-accent-foreground"
                      >
                        <Play className="mr-1 h-3 w-3 text-[#fd5523]" />
                        Test
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditScenario(s)}
                        className="h-8 rounded-lg px-2.5 text-xs"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleDeleteScenario(s)}
                        className="h-8 rounded-lg border-red-100 px-2.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Speaking Assignments */}
          {assignments.length > 0 && (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#062e39]">
                  <CalendarPlus className="h-4 w-4 text-[#fd5523]" />
                  Active Speaking Assignments ({assignments.length})
                </h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#062e39]">{a.scenario_title}</p>
                      <p className="text-xs text-slate-500">
                        {a.group_name ? `Cohort: ${a.group_name}` : "Whole academy"}
                        {a.due_at ? ` · Due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => handleDeleteAssignment(a.id)}
                      className="h-8 w-8 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove assignment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Insights & Misconceptions */}
        <TabsContent value="insights" className="mt-0">
          <TeacherInsightsPanel companyId={companyId} />
        </TabsContent>

        {/* TAB 4: Settings & Activity */}
        <TabsContent value="settings" className="mt-0 grid gap-6 lg:grid-cols-2">
          {/* Tutor Settings */}
          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-[#062e39]">Teacher&apos;s Room Settings</h2>
              <p className="text-xs text-slate-500">
                Control Teacher&apos;s Room availability, monthly free-practice quotas, and allowed interaction modes.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <input
                type="checkbox"
                checked={settings.practice_room_enabled}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, practice_room_enabled: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 accent-[#fd5523]"
              />
              <span>
                <span className="block text-sm font-bold text-[#062e39]">Enable Teacher&apos;s Room</span>
                <span className="block text-xs text-slate-500">
                  Allow enrolled academy learners to practise freely with published AI teachers at /academy/{companySlug}/practice.
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Free Practice Allowance (minutes / learner / month)
              </Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={settings.free_practice_minutes_per_month}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    free_practice_minutes_per_month: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
              <p className="text-[11px] text-slate-400">
                Lesson-embedded speaking blocks are always available to enrolled learners and do not count against this cap.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Academy Default AI Teacher
              </Label>
              <select
                value={settings.default_persona_id ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    default_persona_id: e.target.value || null,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#062e39]"
              >
                <option value="">Platform default (Tinashe)</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name} ({p.languages.join(", ") || "en"})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Used across dashboards (&quot;Today with ...&quot;), Revision Sprints, and new course flows unless overridden.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Allowed Interaction Modes</Label>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-700">
                {(["voice", "text", "live"] as const).map((m) => (
                  <label
                    key={m}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowed_modes.includes(m)}
                      onChange={() => toggleMode(m)}
                      className="accent-[#fd5523]"
                    />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="button"
              disabled={isBusy}
              onClick={handleSaveSettings}
              className="rounded-xl bg-[#062e39] px-5 font-bold text-white hover:bg-[#0a4352]"
            >
              {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save Settings
            </Button>
          </div>

          {/* Staff-Visible Speaking Activity, AI Usage & Teacher Review Queue */}
          <div className="space-y-6">
            {/* AI Usage & Cost Card */}
            {aiUsage && (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-bold text-[#062e39]">
                      <BarChart3 className="h-4 w-4 text-[#fd5523]" />
                      AI Usage &amp; Estimated Cost (Last {aiUsage.periodDays}d)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Metered from your academy&apos;s AI usage ledger across LLM, TTS, and transcription.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#062e39]">
                      ${aiUsage.totalCostUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {aiUsage.totalEvents} API calls
                    </p>
                  </div>
                </div>
                {aiUsage.byKind.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {aiUsage.byKind.map((row) => (
                      <div key={row.kind} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {row.kind.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-sm font-black text-[#062e39]">
                          ${row.costUsd.toFixed(3)}
                        </p>
                        <p className="text-[11px] text-slate-500">{row.events} calls</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Staff-Visible Speaking Activity & Teacher Review Queue */}
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#062e39]">
                    Teacher Review Queue &amp; Speaking Activity
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click any lesson, shared, or flagged speaking session to inspect transcript turns, rubric scores, and leave feedback.
                  </p>
                </div>
                {flaggedSessionsCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                    <Flag className="h-3 w-3" />
                    {flaggedSessionsCount} flagged
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: `All (${sessions.length})` },
                    { id: "flagged", label: `Flagged (${flaggedSessionsCount})` },
                    {
                      id: "shared",
                      label: `Shared (${sessions.filter((s) => s.shared_with_teacher).length})`,
                    },
                    {
                      id: "reviewed",
                      label: `Reviewed (${sessions.filter((s) => s.has_teacher_review).length})`,
                    },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSessionFilter(pill.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      sessionFilter === pill.id
                        ? "bg-[#062e39] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {filteredSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  {sessions.length === 0
                    ? "No completed lesson or shared speaking sessions yet."
                    : `No sessions matching "${sessionFilter}" filter.`}
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredSessions.map((sess) => {
                    const mins = speakingMsToMinutes(sess.learner_speaking_ms);
                    const avgScore = extractReportAverageScore(sess.scores);
                    return (
                      <button
                        type="button"
                        key={sess.id}
                        onClick={() => setReviewingSessionId(sess.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition-colors hover:border-[#062e39]/30 hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-[#062e39]">{sess.learner_name}</p>
                            {sess.shared_with_teacher && (
                              <span title="Shared with teacher" className="inline-flex shrink-0">
                                <Share2 className="h-3 w-3 text-indigo-500" />
                              </span>
                            )}
                            {sess.has_teacher_review && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                <MessageSquare className="h-2.5 w-2.5" />
                                Reviewed
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500">{sess.scenario_title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <span>{sess.origin}</span>
                            <span>·</span>
                            <span>{sess.mode}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> ~{mins}m
                            </span>
                            {avgScore !== null && (
                              <>
                                <span>·</span>
                                <span className="text-teal-700">{avgScore}% score</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            sess.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : sess.status === "flagged"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {sess.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                          {sess.status === "flagged" && <Flag className="h-3 w-3" />}
                          {sess.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Scenario Editor Modal */}
      {editorOpen && (
        <ScenarioEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          companyId={companyId}
          personas={personas}
          initialScenario={editingScenario}
          onSaved={handleScenarioSaved}
        />
      )}

      {/* Session Transcript & Teacher Review Modal */}
      <SessionReviewDrawerModal
        open={Boolean(reviewingSessionId)}
        onOpenChange={(o) => !o && setReviewingSessionId(null)}
        companyId={companyId}
        sessionId={reviewingSessionId}
        onReviewed={handleSessionReviewed}
      />

      {/* Assign Speaking Scenario Modal */}
      <Dialog open={Boolean(assignScenario)} onOpenChange={(o) => !o && setAssignScenario(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-[#062e39]">
              <CalendarPlus className="h-5 w-5 text-[#fd5523]" />
              Assign Speaking Scenario
            </DialogTitle>
            <DialogDescription>
              Assigned scenarios appear in your students&apos; Teacher&apos;s Room under &ldquo;Assigned by Your Teacher&rdquo;.
            </DialogDescription>
          </DialogHeader>
          {assignScenario && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-[#062e39]">{assignScenario.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{assignScenario.goal}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Assign to</Label>
                <select
                  value={assignGroupId}
                  onChange={(e) => setAssignGroupId(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Whole academy (all learners)</option>
                  {classroomGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Cohort: {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Due date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={assignDueAt}
                  onChange={(e) => setAssignDueAt(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAssignScenario(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isBusy}
                  onClick={handleAssignSubmit}
                  className="rounded-xl bg-[#fd5523] font-bold text-white hover:bg-[#ea4817]"
                >
                  {isBusy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Assign Scenario
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
