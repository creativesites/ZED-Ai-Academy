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
  CalendarPlus,
  BarChart3,
  MessageSquareText,
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
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { TUTOR_STYLE_LABELS, overlayModes } from "@/lib/tutor/tutor-session-block";
import {
  createTutorAssignment,
  deleteScenario,
  deleteTutorAssignment,
  getStaffTutorSessionDetail,
  updateScenarioQuick,
  upsertTutorSettings,
  type PersonaRecord,
  type ScenarioRecord,
  type StaffTutorSessionDetail,
  type StaffTutorSessionSummary,
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
  const [assignments, setAssignments] = useState<TutorAssignmentSummary[]>(initialAssignments);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioRecord | null>(null);
  const [previewScenario, setPreviewScenario] = useState<ScenarioRecord | null>(null);
  const [assignScenario, setAssignScenario] = useState<ScenarioRecord | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<string>("");
  const [assignDueAt, setAssignDueAt] = useState<string>("");

  const [reviewDetail, setReviewDetail] = useState<StaffTutorSessionDetail | null>(null);
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null);
  const [isBusy, startBusy] = useTransition();

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

  async function openSessionReview(sessionId: string) {
    setLoadingReviewId(sessionId);
    try {
      const detail = await getStaffTutorSessionDetail(companyId, sessionId);
      if (detail) setReviewDetail(detail);
      else toast.error("Session details not found");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load transcript");
    } finally {
      setLoadingReviewId(null);
    }
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
            value="settings"
            className="h-10 rounded-xl px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
          >
            <Settings className="mr-1.5 h-4 w-4 text-[#fd5523]" />
            Settings &amp; Activity ({initialSessions.length})
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewScenario(s)}
                        className="h-8 rounded-lg px-2.5 text-xs font-bold"
                      >
                        <Play className="mr-1 h-3 w-3 text-[#fd5523]" />
                        Test
                      </Button>
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

        {/* TAB 3: Settings & Activity */}
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

          {/* Staff-Visible Speaking Activity + AI Usage */}
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

            {/* Staff-Visible Speaking Activity */}
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-[#062e39]">Recent Speaking Sessions</h2>
                <p className="text-xs text-slate-500">
                  Click any session to inspect the full transcript, guidance scores, and corrections.
                </p>
              </div>

              {initialSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  No completed lesson or shared speaking sessions yet.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {initialSessions.map((sess) => {
                    const mins = Math.max(1, Math.round(sess.learner_speaking_ms / 60000));
                    const isLoadingThis = loadingReviewId === sess.id;
                    return (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => void openSessionReview(sess.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-[#fd5523]/40 hover:bg-[#fff6ee]/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#062e39]">{sess.learner_name}</p>
                          <p className="truncate text-xs text-slate-500">{sess.scenario_title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <span>{sess.origin}</span>
                            <span>·</span>
                            <span>{sess.mode}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> ~{mins}m
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                              sess.status === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : sess.status === "flagged"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {sess.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                            {sess.status}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                            {isLoadingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MessageSquareText className="h-3 w-3 text-[#fd5523]" />
                            )}
                            Review
                          </span>
                        </div>
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

      {/* Live Preview Dialog */}
      <Dialog open={Boolean(previewScenario)} onOpenChange={(o) => !o && setPreviewScenario(null)}>
        <DialogContent className="h-[85vh] max-w-5xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Test AI Teacher Scenario</DialogTitle>
          <DialogDescription className="sr-only">
            Interactive preview with the animated AI teacher.
          </DialogDescription>
          {previewScenario && (
            <TutorSession
              origin="practice"
              scenarioId={previewScenario.id}
              scene={previewScenario.scene ?? undefined}
              look={previewScenario.persona?.look}
              preview={{
                teacherName: previewScenario.persona?.display_name ?? previewScenario.persona?.name,
                title: previewScenario.title,
                goal: previewScenario.goal,
                maxMinutes: previewScenario.max_minutes,
                modes: overlayModes(previewScenario.allowed_modes),
              }}
              onExit={() => setPreviewScenario(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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

      {/* Session Transcript & Report Review Modal */}
      <Dialog open={Boolean(reviewDetail)} onOpenChange={(o) => !o && setReviewDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#062e39]">
              {reviewDetail?.learner_name} — {reviewDetail?.scenario_title}
            </DialogTitle>
            <DialogDescription>
              {reviewDetail
                ? `${reviewDetail.origin} · ${reviewDetail.mode} · ${new Date(reviewDetail.started_at).toLocaleString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {reviewDetail && (
            <div className="space-y-5 pt-2">
              {reviewDetail.scores && Object.keys(reviewDetail.scores).length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {Object.entries(reviewDetail.scores).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
                      <p className="mt-0.5 text-lg font-black text-[#062e39]">{v}%</p>
                    </div>
                  ))}
                </div>
              )}

              {reviewDetail.strengths.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">Strengths</h4>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {reviewDetail.strengths.map((st, i) => (
                      <li key={i}>• {st}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reviewDetail.mistakes.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Corrections</h4>
                  <ul className="space-y-1.5">
                    {reviewDetail.mistakes.map((m, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                        <span className="text-slate-400 line-through">{m.said}</span> →{" "}
                        <span className="font-bold text-[#062e39]">{m.correct}</span>{" "}
                        <span className="text-[10px] uppercase text-slate-400">({m.category})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Conversation Transcript ({reviewDetail.turns.length} turns)
                </h4>
                {reviewDetail.turns.length === 0 ? (
                  <p className="text-xs text-slate-400">No turns recorded.</p>
                ) : (
                  <div className="space-y-2.5">
                    {reviewDetail.turns.map((t) => (
                      <div key={t.idx} className="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                        {t.learner_text && (
                          <p className="text-slate-800">
                            <span className="font-bold text-[#fd5523]">Learner:</span> {t.learner_text}
                          </p>
                        )}
                        {t.teacher_lines.map((line, li) => (
                          <p key={li} className="text-slate-700">
                            <span className="font-bold text-[#062e39]">AI Teacher:</span> {line}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
