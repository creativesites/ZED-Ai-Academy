"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Play,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Wand2,
  Loader2,
  ExternalLink,
  Award,
  Zap,
  CheckCircle2,
  Eye,
  Share2,
} from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { ScenarioEditorModal } from "@/components/tutor/studio/ScenarioEditorModal";
import { TeacherInsightsPanel } from "@/components/tutor/studio/TeacherInsightsPanel";
import { CourseObjectivesPanel } from "@/components/creator/course-objectives-panel";
import { VivaRubricEditor } from "@/components/creator/viva-rubric-editor";
import { AUTHORING_TEMPLATES, type AuthoringTemplateId } from "@/lib/tutor/authoring/templates";
import { TUTOR_STYLE_LABELS } from "@/lib/tutor/tutor-session-block";
import {
  deleteScenario,
  getCourseVivaConfig,
  listScenariosForCourseStudio,
  seedStarterPersonas,
  updateCourseVivaConfig,
  updateScenarioQuick,
  type PersonaRecord,
  type ScenarioRecord,
} from "@/actions/tutor-authoring";
import { Button } from "@/components/ui/button";

export function CourseTutorTab({
  courseId,
  companyId,
  tenantSlug,
  initialPersonas,
  initialScenarios,
}: {
  courseId: string;
  companyId: string;
  tenantSlug?: string;
  initialPersonas: PersonaRecord[];
  initialScenarios: ScenarioRecord[];
}) {
  const [personas, setPersonas] = useState<PersonaRecord[]>(initialPersonas);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>(initialScenarios);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioRecord | null>(null);
  const [isBusy, startBusy] = useTransition();

  // Course Autopilot state
  const [autopilotTemplate, setAutopilotTemplate] = useState<AuthoringTemplateId | "auto">("auto");
  const [autopilotPersonaId, setAutopilotPersonaId] = useState<string>(initialPersonas[0]?.id ?? "");
  const [autopilotAutoPublish, setAutopilotAutoPublish] = useState<boolean>(true);
  const [autopilotPreview, setAutopilotPreview] = useState<
    Array<{
      lessonId: string;
      lessonTitle: string;
      moduleTitle: string;
      hasExistingTutorBlock: boolean;
      willGenerate: boolean;
      templateLabel: string;
    }> | null
  >(null);
  const [autopilotPreviewLoading, setAutopilotPreviewLoading] = useState(false);
  const [autopilotResults, setAutopilotResults] = useState<
    Array<{ lessonId: string; lessonTitle: string; scenarioTitle?: string; status: string; error?: string }>
  >([]);
  const [autopilotRunning, setAutopilotRunning] = useState(false);

  // Certificate Viva state (optional per course)
  const [vivaAvailable, setVivaAvailable] = useState(true);
  const [requireViva, setRequireViva] = useState(false);
  const [vivaScenarioId, setVivaScenarioId] = useState<string>("");
  const [vivaWorking, setVivaWorking] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    let active = true;
    getCourseVivaConfig(courseId)
      .then((cfg) => {
        if (!active) return;
        setVivaAvailable(cfg.available);
        setRequireViva(cfg.requireCertificateViva);
        setVivaScenarioId(cfg.vivaScenarioId ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [courseId]);

  async function handlePreviewAutopilot() {
    setAutopilotPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/ai/teacher/autopilot?courseId=${encodeURIComponent(courseId)}&templateId=${encodeURIComponent(autopilotTemplate)}`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not load plan");
      setAutopilotPreview(Array.isArray(data.lessons) ? data.lessons : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not preview plan");
    } finally {
      setAutopilotPreviewLoading(false);
    }
  }

  async function handleRunAutopilot() {
    setAutopilotRunning(true);
    setAutopilotResults([]);
    try {
      const res = await fetch("/api/ai/teacher/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          templateId: autopilotTemplate,
          personaId: autopilotPersonaId || null,
          publish: autopilotAutoPublish,
          attachBlock: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Autopilot failed");

      const list = Array.isArray(data.results) ? data.results : [];
      setAutopilotResults(list);
      setAutopilotPreview(null);
      const createdCount = list.filter((r: { status: string }) => r.status === "created").length;
      if (createdCount > 0) {
        const refreshed = await listScenariosForCourseStudio(courseId);
        setScenarios(refreshed);
        toast.success(
          `Autopilot built ${autopilotAutoPublish ? "& published " : ""}AI Teacher flows for ${createdCount} lesson(s)!`,
        );
      } else {
        toast.info("All teachable lessons already have AI Teacher flows.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not run Course Autopilot");
    } finally {
      setAutopilotRunning(false);
    }
  }

  function handlePublishAllDrafts() {
    const drafts = scenarios.filter((s) => s.status !== "published");
    if (drafts.length === 0) return;
    startBusy(async () => {
      try {
        await Promise.all(
          drafts.map((s) => updateScenarioQuick(companyId, s.id, { status: "published" })),
        );
        setScenarios((prev) => prev.map((s) => ({ ...s, status: "published" })));
        toast.success(`Published ${drafts.length} AI Teacher flow(s)!`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not publish all drafts");
      }
    });
  }

  function handleCopyPublicTryLink(scenarioId: string) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/try/${scenarioId}`;
    void navigator.clipboard?.writeText(url);
    toast.success("Public mini-lesson link copied! Share it anywhere to attract new learners.");
  }

  async function handleSaveVivaConfig(nextRequired: boolean, nextScenarioId: string) {
    setVivaWorking(true);
    try {
      const res = await updateCourseVivaConfig({
        courseId,
        requireCertificateViva: nextRequired,
        vivaScenarioId: nextScenarioId || null,
      });
      setVivaAvailable(res.available);
      setRequireViva(res.requireCertificateViva);
      setVivaScenarioId(res.vivaScenarioId ?? "");
      if (res.available) {
        toast.success(nextRequired ? "Certificate Viva enabled" : "Certificate Viva disabled");
      } else {
        toast.info("Apply the Phase 3 migration to persist Certificate Viva settings.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save Certificate Viva setting");
    } finally {
      setVivaWorking(false);
    }
  }

  async function handleGenerateVivaFlow() {
    setVivaWorking(true);
    try {
      const res = await fetch("/api/ai/teacher/viva-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          personaId: autopilotPersonaId || null,
          enableVivaGate: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not generate Certificate Viva");

      const refreshed = await listScenariosForCourseStudio(courseId);
      setScenarios(refreshed);
      setVivaScenarioId(data.scenarioId);
      setRequireViva(Boolean(data.vivaLinked));
      toast.success(`Certificate Viva "${data.title}" drafted!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not draft Certificate Viva");
    } finally {
      setVivaWorking(false);
    }
  }

  const manageTeachersHref = tenantSlug
    ? `/academy/${tenantSlug}/admin/ai-teachers`
    : "/creator/ai-teachers";

  function handleSaved(saved: ScenarioRecord) {
    setScenarios((prev) =>
      prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...prev]
    );
  }

  function handleSeedPersonas() {
    startBusy(async () => {
      try {
        const seeded = await seedStarterPersonas(companyId);
        setPersonas(seeded);
        toast.success("Starter AI teacher cast added! You can now pick them in scenarios.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not import starter cast");
      }
    });
  }

  function toggleStatus(s: ScenarioRecord) {
    const nextStatus = s.status === "published" ? "draft" : "published";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { status: nextStatus });
        handleSaved(updated);
        toast.success(nextStatus === "published" ? "Scenario published" : "Moved to draft");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  function toggleVisibility(s: ScenarioRecord) {
    const nextVis = s.visibility === "tenant_library" ? "course" : "tenant_library";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { visibility: nextVis });
        handleSaved(updated);
        toast.success(
          nextVis === "tenant_library"
            ? "Shared to the academy Teacher's Room"
            : "Limited to this course"
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update visibility");
      }
    });
  }

  function handleDelete(s: ScenarioRecord) {
    if (!confirm(`Delete "${s.title}"?`)) return;
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

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6ee] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#fd5523]">
            <Sparkles className="h-3.5 w-3.5" />
            Animated AI Teacher
          </div>
          <h2 className="text-xl font-black text-[#062e39]">AI Teacher Flows</h2>
          <p className="max-w-2xl text-xs text-slate-500 sm:text-sm">
            Create interactive role-plays, guided lessons, or oral checks for this course. Published flows appear in your Lesson Studio &quot;AI Teacher&quot; blocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scenarios.some((s) => s.status !== "published") && (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={handlePublishAllDrafts}
              className="h-10 rounded-xl border-emerald-200 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Publish All Drafts ({scenarios.filter((s) => s.status !== "published").length})
            </Button>
          )}
          <Link
            href={manageTeachersHref}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-[#062e39] hover:bg-slate-100"
          >
            Customize AI Teachers
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <Button
            type="button"
            onClick={() => {
              setEditingScenario(null);
              setEditorOpen(true);
            }}
            className="h-10 rounded-xl bg-[#fd5523] px-4 text-xs font-bold text-white hover:bg-[#ea4817]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New AI Teacher Flow
          </Button>
        </div>
      </div>

      {/* Phase 3 Scale Tools: Course Autopilot & Optional Certificate Viva */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Course Autopilot */}
        <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#fd5523]">
                <Zap className="h-3.5 w-3.5" /> Course Autopilot
              </span>
              <h3 className="mt-1 text-base font-bold text-[#062e39]">
                Auto-add AI Teachers to lessons
              </h3>
              <p className="text-xs text-slate-500">
                Scans lessons without an AI Teacher block (up to 6 per batch), extracts objectives, and attaches a flow.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={autopilotTemplate}
              onChange={(e) => setAutopilotTemplate(e.target.value as AuthoringTemplateId | "auto")}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#062e39]"
            >
              <option value="auto">Auto template per lesson</option>
              {AUTHORING_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={autopilotPersonaId}
              onChange={(e) => setAutopilotPersonaId(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#062e39]"
            >
              <option value="">Default course teacher</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || p.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={autopilotAutoPublish}
              onChange={(e) => setAutopilotAutoPublish(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#fd5523]"
            />
            Auto-publish generated flows immediately
          </label>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={autopilotPreviewLoading || autopilotRunning}
              onClick={() => void handlePreviewAutopilot()}
              className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold text-[#062e39]"
            >
              {autopilotPreviewLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5 text-[#fd5523]" />
              )}
              Preview Plan
            </Button>
            <Button
              type="button"
              disabled={autopilotRunning}
              onClick={() => void handleRunAutopilot()}
              className="h-9 flex-1 rounded-xl bg-[#062e39] text-xs font-bold text-white hover:bg-[#0a4352]"
            >
              {autopilotRunning ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {autopilotRunning ? "Drafting lesson flows..." : "Run Course Autopilot"}
            </Button>
          </div>

          {autopilotPreview && (
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Autopilot lesson plan</span>
                <span>
                  {autopilotPreview.filter((l) => l.willGenerate).length} ready to generate
                </span>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {autopilotPreview.map((l) => (
                  <li key={l.lessonId} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[#062e39]">{l.lessonTitle}</span>
                    {l.hasExistingTutorBlock ? (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Already has teacher
                      </span>
                    ) : l.willGenerate ? (
                      <span className="shrink-0 rounded-full bg-[#fff2e9] px-2 py-0.5 text-[10px] font-bold text-[#c83a10]">
                        {l.templateLabel}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-slate-400">Next batch / empty</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {autopilotResults.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl bg-slate-50 p-3 text-xs">
              {autopilotResults.map((r) => (
                <li key={r.lessonId} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-[#062e39]">{r.lessonTitle}</span>
                  {r.status === "created" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Added
                    </span>
                  ) : (
                    <span className="shrink-0 text-rose-600">{r.error || "Failed"}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Certificate Viva (Optional per course) */}
        <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              <Award className="h-3.5 w-3.5" /> Certificate Viva (Optional)
            </span>
            <h3 className="mt-1 text-base font-bold text-[#062e39]">
              End-of-course Oral Check Gate
            </h3>
            <p className="text-xs text-slate-500">
              Optionally require learners to pass an AI Teacher oral viva before claiming their course certificate.
            </p>
          </div>

          {!vivaAvailable && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Phase 3 DB migration needed before course viva gating can be saved. You can still generate the oral check flow now.
            </p>
          )}

          <label className="flex items-center gap-2.5 text-xs font-semibold text-[#062e39]">
            <input
              type="checkbox"
              checked={requireViva}
              disabled={!vivaAvailable || vivaWorking}
              onChange={(e) => {
                const next = e.target.checked;
                setRequireViva(next);
                void handleSaveVivaConfig(next, vivaScenarioId);
              }}
              className="h-4 w-4 accent-[#fd5523]"
            />
            Require learners to pass oral viva to claim certificate
          </label>

          <div className="flex flex-wrap gap-2">
            <select
              value={vivaScenarioId}
              disabled={!vivaAvailable || vivaWorking}
              onChange={(e) => {
                const nextId = e.target.value;
                setVivaScenarioId(nextId);
                void handleSaveVivaConfig(requireViva, nextId);
              }}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-[#062e39]"
            >
              <option value="">Select oral viva flow...</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.style})
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={vivaWorking}
              onClick={() => void handleGenerateVivaFlow()}
              className="h-9 shrink-0 rounded-xl text-xs font-bold text-[#062e39]"
            >
              {vivaWorking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#fd5523]" />
              )}
              Auto-draft Viva
            </Button>
          </div>

          {requireViva && (
            <VivaRubricEditor
              courseId={courseId}
              reviewsHref={tenantSlug ? `/academy/${tenantSlug}/admin/ai-teachers/reviews` : null}
            />
          )}
        </div>
      </div>

      {/* Course-level Insights & Misconceptions */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#062e39]">
              Course Learner Insights &amp; Misconceptions
            </h3>
            <p className="text-xs text-slate-500">
              See where enrolled learners stumble on this course&apos;s objectives and inspect objective mastery.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowInsights((prev) => !prev)}
            className="h-9 rounded-xl text-xs font-bold text-[#062e39]"
          >
            {showInsights ? "Hide Course Insights" : "View Course Insights"}
          </Button>
        </div>
        {showInsights && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <TeacherInsightsPanel companyId={companyId} courseId={courseId} />
          </div>
        )}
      </div>

      <CourseObjectivesPanel courseId={courseId} />

      {/* Starter cast notice if no personas exist yet */}
      {personas.length === 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-950">No AI teacher personas configured yet</p>
            <p className="text-xs text-amber-800">
              Import the 5 animated starter teachers (Lín Lǎoshī, Sofía, Camille, Nurse Tendai, Tinashe) in one click so you can assign them to scenarios.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={handleSeedPersonas}
            className="shrink-0 rounded-xl bg-[#062e39] text-xs font-bold text-white hover:bg-[#0a4352]"
          >
            {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
            Import Starter Cast
          </Button>
        </div>
      )}

      {/* Scenario Cards */}
      {scenarios.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-[#1a1338] to-[#321b4e] shadow-lg">
            <Teacher
              variant="bust"
              persona={personas[0]?.rive_variant ?? DEFAULT_PERSONA_LOOK}
              className="h-24 w-24"
              label="Animated AI teacher"
            />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#062e39]">Add your first AI Teacher flow</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 sm:text-sm">
            Draft a speaking role-play manually or let AI build one from your course curriculum. Learners will practise out loud with the animated 3D/Rive teacher.
          </p>
          <Button
            type="button"
            onClick={() => {
              setEditingScenario(null);
              setEditorOpen(true);
            }}
            className="mt-5 h-11 rounded-xl bg-[#fd5523] px-6 font-bold text-white hover:bg-[#ea4817]"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create AI Teacher Flow
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
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
                    {s.max_minutes} min · {s.beats.length} beats
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
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
                    onClick={() => toggleVisibility(s)}
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
                  {s.status === "published" && (s.visibility === "tenant_library" || s.visibility === "platform") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPublicTryLink(s.id)}
                      title="Copy shareable public mini-lesson link (/try/...)"
                      className="h-8 rounded-lg px-2.5 text-xs font-bold text-[#062e39]"
                    >
                      <Share2 className="mr-1 h-3 w-3 text-[#fd5523]" />
                      Share
                    </Button>
                  )}
                  <Link
                    href={
                      tenantSlug
                        ? `/academy/${tenantSlug}/practice/${s.id}`
                        : `/practice/${s.id}`
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
                    onClick={() => {
                      setEditingScenario(s);
                      setEditorOpen(true);
                    }}
                    className="h-8 rounded-lg px-2.5 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleDelete(s)}
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

      {editorOpen && (
        <ScenarioEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          companyId={companyId}
          courseId={courseId}
          personas={personas}
          initialScenario={editingScenario}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
