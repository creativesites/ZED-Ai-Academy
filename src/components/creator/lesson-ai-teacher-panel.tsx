"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  Clock,
  Layers,
  Loader2,
  MapPin,
  MessageSquareText,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import {
  deleteTeacherMoment,
  upsertScenario,
  upsertTeacherMoment,
  type PersonaRecord,
  type ScenarioRecord,
  type TeacherMomentRecord,
} from "@/actions/tutor-authoring";
import { saveLessonObjectivesAction } from "@/actions/tutor-objectives";
import type { TutorScenarioOption } from "@/actions/tutor-scenarios";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { FlowStoryboard } from "@/components/tutor/studio/FlowStoryboard";
import { createTeacherPreviewClient } from "@/components/tutor/studio/previewClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DraftedFlow, FlowDiffEntry, FlowStep } from "@/lib/tutor/authoring/flow";
import type { LessonObjective } from "@/lib/tutor/authoring/objectives";
import type { PreviewFlowPayload } from "@/lib/tutor/authoring/preview";
import {
  AUTHORING_TEMPLATES,
  type AuthoringTemplateId,
} from "@/lib/tutor/authoring/templates";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { TUTOR_STYLE_LABELS, overlayModes, type TutorSessionBlock } from "@/lib/tutor/tutor-session-block";
import { cn } from "@/lib/utils";
import type { ContentBlockType, Json } from "@/types/database";

type LessonBlockRef = {
  id: string;
  type: ContentBlockType;
  position: number;
  content: Json;
};

const TEMPLATE_ICONS: Record<AuthoringTemplateId, React.ElementType> = {
  explain_check: BookOpenCheck,
  worked_example: Layers,
  role_play: Users,
  oral_check: Mic,
  debate_defend: Scale,
  revision_sprint: Zap,
};

const SCENE_LABELS: Record<SceneArtboard, string> = {
  Scene_Classroom: "Classroom",
  Scene_Studio: "Studio",
  Scene_TeaHouse: "Tea House",
  Scene_Cafe: "Café",
  Scene_Rooftop: "Rooftop",
  Scene_Clinic: "Clinic",
};

function blockLabel(block: LessonBlockRef, index: number): string {
  const c = (block.content ?? {}) as Record<string, unknown>;
  const rawTitle = typeof c.title === "string" && c.title.trim() ? c.title.trim() : null;
  const typeName = block.type.replace(/_/g, " ");
  return rawTitle ? `${index + 1}. ${rawTitle} (${typeName})` : `${index + 1}. ${typeName}`;
}

export function LessonAITeacherPanel({
  courseId,
  courseStatus,
  companyId,
  lessonId,
  lessonTitle,
  blocks,
  personas,
  defaultPersonaId,
  availableScenarios,
  momentsAvailable,
  initialMoments,
  onInsertTutorBlock,
}: {
  courseId: string;
  courseStatus: string;
  companyId: string;
  lessonId: string;
  lessonTitle: string;
  blocks: LessonBlockRef[];
  personas: PersonaRecord[];
  defaultPersonaId: string | null;
  availableScenarios: TutorScenarioOption[];
  momentsAvailable: boolean;
  initialMoments: TeacherMomentRecord[];
  onInsertTutorBlock: (content: TutorSessionBlock) => Promise<void>;
}) {
  const hasTutorBlock = blocks.some((b) => b.type === "tutor_session");
  const [stage, setStage] = useState<"start" | "objectives" | "storyboard">("start");

  // Step 1 state: objectives + template + persona
  const [extracting, setExtracting] = useState(false);
  const [objectives, setObjectives] = useState<LessonObjective[]>([]);
  const [templateId, setTemplateId] = useState<AuthoringTemplateId>("explain_check");
  const [personaId, setPersonaId] = useState<string>(defaultPersonaId ?? personas[0]?.id ?? "");

  // Step 2 state: drafted flow + undo/diff + preview + saving
  const [drafting, setDrafting] = useState(false);
  const [flow, setFlow] = useState<DraftedFlow | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<DraftedFlow | null>(null);
  const [diff, setDiff] = useState<FlowDiffEntry[] | null>(null);
  const [revising, setRevising] = useState(false);
  const [savedScenario, setSavedScenario] = useState<ScenarioRecord | null>(null);
  const [addingToLesson, setAddingToLesson] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Teacher moments state
  const [moments, setMoments] = useState<TeacherMomentRecord[]>(initialMoments);
  const [scenarios, setScenarios] = useState<TutorScenarioOption[]>(availableScenarios);
  const [momentScenarioId, setMomentScenarioId] = useState<string>(availableScenarios[0]?.id ?? "");
  const [momentAfterBlockId, setMomentAfterBlockId] = useState<string>(blocks[0]?.id ?? "");
  const [momentTitle, setMomentTitle] = useState("");
  const [momentPrompt, setMomentPrompt] = useState("");
  const [momentBusy, startMomentBusy] = useTransition();

  const selectedPersona = personas.find((p) => p.id === personaId) ?? null;

  const previewFlow = useMemo<PreviewFlowPayload | null>(
    () =>
      flow
        ? {
            scenarioId: savedScenario?.id ?? null,
            courseId,
            lessonId,
            companyId,
            personaId: personaId || null,
            title: flow.title,
            goal: flow.goal,
            style: flow.style,
            scene: flow.scene,
            maxMinutes: flow.maxMinutes,
            skillPack: flow.skillPack,
            steps: flow.steps,
            targetItems: flow.targetItems,
          }
        : null,
    [flow, savedScenario?.id, courseId, lessonId, companyId, personaId],
  );

  const previewClient = useMemo(
    () => (previewFlow ? createTeacherPreviewClient(() => previewFlow) : undefined),
    [previewFlow],
  );

  async function handleExtractObjectives() {
    if (extracting) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/ai/teacher/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId }),
      });
      const data = (await res.json()) as {
        error?: string;
        objectives?: LessonObjective[];
        defaultPersonaId?: string | null;
      };
      if (!res.ok || !data.objectives) {
        throw new Error(data.error || "Could not extract objectives");
      }
      setObjectives(data.objectives);
      if (data.defaultPersonaId && !personaId) {
        setPersonaId(data.defaultPersonaId);
      }
      setStage("objectives");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not extract objectives");
    } finally {
      setExtracting(false);
    }
  }

  async function handleDraftFlow() {
    const cleanObjectives = objectives.filter((o) => o.text.trim().length > 0 && o.evidence.trim().length > 0);
    if (cleanObjectives.length === 0) {
      toast.error("Keep at least one learning objective before drafting.");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/teacher/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          objectives: cleanObjectives,
          templateId,
          personaId: personaId || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        flow?: DraftedFlow;
        personaId?: string | null;
      };
      if (!res.ok || !data.flow) {
        throw new Error(data.error || "Could not draft flow");
      }
      setFlow(data.flow);
      setUndoSnapshot(null);
      setDiff(null);
      setSavedScenario(null);
      if (data.personaId) setPersonaId(data.personaId);
      setStage("storyboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not draft flow");
    } finally {
      setDrafting(false);
    }
  }

  async function handleAiRevise(instruction: string) {
    if (!flow) return;
    setRevising(true);
    try {
      const res = await fetch("/api/ai/teacher/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          flow,
          instruction,
          objectives,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        flow?: DraftedFlow;
        diff?: FlowDiffEntry[];
      };
      if (!res.ok || !data.flow) {
        throw new Error(data.error || "Could not update flow");
      }
      setUndoSnapshot(flow);
      setFlow(data.flow);
      setDiff(data.diff ?? []);
      setSavedScenario(null);
      toast.success("Flow updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI edit failed");
    } finally {
      setRevising(false);
    }
  }

  function handleUndo() {
    if (!undoSnapshot) return;
    setFlow(undoSnapshot);
    setUndoSnapshot(null);
    setDiff(null);
    toast.success("Reverted to previous version");
  }

  async function persistCurrentFlow(): Promise<ScenarioRecord> {
    if (!flow) throw new Error("No flow to save");
    const status = courseStatus === "published" ? "published" : "draft";
    const saved = await upsertScenario({
      id: savedScenario?.id,
      companyId,
      courseId,
      lessonId,
      skillPack: flow.skillPack,
      personaId: personaId || null,
      title: flow.title.trim(),
      goal: flow.goal.trim(),
      beats: flow.steps
        .filter((s) => s.goal.trim().length > 0)
        .map((s) => ({
          id: s.id,
          goal: s.goal.trim(),
          ...(s.boardContent.trim() ? { boardContent: s.boardContent.trim() } : {}),
          ...(s.checkQuestion.trim() ? { checkQuestion: s.checkQuestion.trim() } : {}),
          ...(s.targetItems?.length ? { targetItems: s.targetItems } : {}),
        })),
      targetItems: flow.targetItems,
      maxMinutes: flow.maxMinutes,
      allowedModes: ["voice", "text"],
      scene: flow.scene,
      visibility: "course",
      style: flow.style,
      status,
    });
    setSavedScenario(saved);
    // P2-01: the reviewed objectives ("accept all", edited inline above) go into the course registry and
    // are linked to this flow. Never blocks saving the flow (registry may not be migrated yet).
    const accepted = objectives.filter((o) => o.text.trim().length >= 3);
    if (accepted.length > 0) {
      saveLessonObjectivesAction({
        courseId,
        lessonId,
        scenarioId: saved.id,
        objectives: accepted.map((o) => ({ text: o.text, evidence: o.evidence })),
      }).catch((err: unknown) => {
        console.warn("[lesson-ai-teacher] could not save objectives to the course registry", err);
      });
    }
    return saved;
  }

  async function handleAddToLesson() {
    if (!flow || addingToLesson) return;
    setAddingToLesson(true);
    try {
      const saved = await persistCurrentFlow();
      await onInsertTutorBlock({
        scenarioId: saved.id,
        style: saved.style,
        required: false,
        title: saved.title,
        intro: saved.goal,
      });

      const newOpt: TutorScenarioOption = {
        id: saved.id,
        title: saved.title,
        goal: saved.goal,
        style: saved.style,
        scene: saved.scene ?? undefined,
        maxMinutes: saved.max_minutes,
        modes: overlayModes(saved.allowed_modes),
        visibility: saved.visibility,
        status: saved.status,
        skillPack: saved.skill_pack,
        personaId: saved.persona_id,
        beats: saved.beats,
        targetItems: saved.target_items,
        persona: saved.persona
          ? {
              name: saved.persona.name,
              displayName: saved.persona.display_name,
              look: saved.persona.look,
            }
          : null,
      };
      setScenarios((prev) => [newOpt, ...prev.filter((s) => s.id !== newOpt.id)]);
      setMomentScenarioId(saved.id);
      toast.success(
        courseStatus === "published"
          ? "AI Teacher added to lesson!"
          : "AI Teacher added to lesson (will go live when you publish the course).",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add AI teacher to lesson");
    } finally {
      setAddingToLesson(false);
    }
  }

  function handleAddMoment() {
    if (!momentScenarioId) {
      toast.error("Choose or create an AI Teacher flow first.");
      return;
    }
    startMomentBusy(async () => {
      try {
        const created = await upsertTeacherMoment({
          courseId,
          lessonId,
          scenarioId: momentScenarioId,
          afterBlockId: momentAfterBlockId || null,
          position: moments.length + 1,
          title: momentTitle.trim() || null,
          prompt: momentPrompt.trim() || null,
          required: false,
          status: courseStatus === "published" ? "published" : "draft",
        });
        setMoments((prev) => [...prev, created]);
        setMomentTitle("");
        setMomentPrompt("");
        toast.success("Teacher moment placed in lesson");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add teacher moment");
      }
    });
  }

  function handleDeleteMoment(momentId: string) {
    startMomentBusy(async () => {
      try {
        await deleteTeacherMoment(momentId, lessonId, courseId);
        setMoments((prev) => prev.filter((m) => m.id !== momentId));
        toast.success("Teacher moment removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove moment");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-ink via-[#083b49] to-[#0c4a5c] p-4 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
            <Teacher
              variant="bust"
              persona={selectedPersona?.rive_variant ?? DEFAULT_PERSONA_LOOK}
              className="h-12 w-12"
              label={selectedPersona?.display_name ?? selectedPersona?.name ?? "AI Teacher"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-electric">
              AI Teacher Co-Author
            </p>
            <h3 className="truncate text-sm font-bold">
              {stage === "start" && "Teach & check this lesson"}
              {stage === "objectives" && "Review lesson objectives"}
              {stage === "storyboard" && (flow?.title || "Review flow storyboard")}
            </h3>
          </div>
          {stage !== "start" && (
            <button
              type="button"
              onClick={() => setStage(stage === "storyboard" ? "objectives" : "start")}
              aria-label="Go back"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
        </div>

        {/* STAGE 0: Start */}
        {stage === "start" && (
          <div className="space-y-4 p-4">
            <p className="text-xs leading-relaxed text-slate-600">
              Turn <span className="font-semibold text-ink">{lessonTitle || "this lesson"}</span> into an
              interactive AI Teacher flow in under two minutes — no prompt writing needed.
            </p>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                <span>1. Pull 2–5 measurable objectives from your blocks</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                <span>2. Draft a step-by-step storyboard &amp; tweak in plain words</span>
              </div>
              <div className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                <span>3. Test as a student, then add to your lesson</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleExtractObjectives}
              disabled={extracting}
              className="h-11 w-full rounded-xl bg-brand text-xs font-bold text-white hover:bg-brand-hover"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading lesson blocks…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {hasTutorBlock ? "Draft another AI Teacher flow" : "Add an AI teacher to this lesson"}
                </>
              )}
            </Button>
          </div>
        )}

        {/* STAGE 1: Objectives + Template + Teacher */}
        {stage === "objectives" && (
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-ink">Learning objectives ({objectives.length})</p>
                <p className="text-[11px] text-slate-500">Edit what learners should prove out loud.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={extracting}
                  onClick={handleExtractObjectives}
                  className="h-7 rounded-lg text-[11px]"
                >
                  <RefreshCw className={cn("mr-1 h-3 w-3", extracting && "animate-spin")} />
                  Re-extract
                </Button>
                {objectives.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setObjectives((prev) => [
                        ...prev,
                        { id: `obj-${prev.length + 1}`, text: "Learner can ", evidence: "" },
                      ])
                    }
                    className="h-7 rounded-lg text-[11px]"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {objectives.map((obj, idx) => (
                <div key={obj.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`obj-text-${obj.id}`} className="text-[11px] font-bold text-ink">
                      Objective {idx + 1}
                    </Label>
                    {objectives.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove objective ${idx + 1}`}
                        onClick={() => setObjectives((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    id={`obj-text-${obj.id}`}
                    value={obj.text}
                    onChange={(e) =>
                      setObjectives((prev) =>
                        prev.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)),
                      )
                    }
                    placeholder="Learner can ..."
                    className="bg-white text-xs"
                  />
                  <div className="space-y-1">
                    <Label htmlFor={`obj-ev-${obj.id}`} className="text-[10px] font-semibold text-slate-500">
                      What counts as evidence
                    </Label>
                    <Input
                      id={`obj-ev-${obj.id}`}
                      value={obj.evidence}
                      onChange={(e) =>
                        setObjectives((prev) =>
                          prev.map((o, i) => (i === idx ? { ...o, evidence: e.target.value } : o)),
                        )
                      }
                      placeholder="Explains the rule and solves one example..."
                      className="bg-white text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 6 Templates */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-ink">Flow template</Label>
              <div className="grid grid-cols-2 gap-2">
                {AUTHORING_TEMPLATES.map((tpl) => {
                  const Icon = TEMPLATE_ICONS[tpl.id];
                  const active = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTemplateId(tpl.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        active
                          ? "border-brand bg-brand-soft ring-1 ring-brand/30"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <Icon className={cn("h-3.5 w-3.5", active ? "text-brand-text" : "text-slate-500")} />
                        {tpl.label}
                      </span>
                      <span className="line-clamp-2 text-[10px] leading-snug text-slate-500">{tpl.tagline}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Teacher Selector */}
            {personas.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="lesson-ai-teacher-persona" className="text-xs font-bold text-ink">
                  Teacher
                </Label>
                <select
                  id="lesson-ai-teacher-persona"
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="button"
              disabled={drafting}
              onClick={handleDraftFlow}
              className="h-11 w-full rounded-xl bg-brand text-xs font-bold text-white hover:bg-brand-hover"
            >
              {drafting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Drafting storyboard…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Draft the flow
                </>
              )}
            </Button>
          </div>
        )}

        {/* STAGE 2: Storyboard + AI edit bar + Test as student + Add to lesson */}
        {stage === "storyboard" && flow && (
          <div className="space-y-4 p-4">
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="space-y-1">
                <Label htmlFor="flow-title" className="text-[11px] font-semibold text-slate-600">
                  Flow title
                </Label>
                <Input
                  id="flow-title"
                  value={flow.title}
                  onChange={(e) => setFlow({ ...flow, title: e.target.value })}
                  className="bg-white text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="flow-goal" className="text-[11px] font-semibold text-slate-600">
                  Learner goal
                </Label>
                <Textarea
                  id="flow-goal"
                  rows={2}
                  value={flow.goal}
                  onChange={(e) => setFlow({ ...flow, goal: e.target.value })}
                  className="resize-none bg-white text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="flow-scene" className="text-[11px] font-semibold text-slate-600">
                    Scene
                  </Label>
                  <select
                    id="flow-scene"
                    value={flow.scene}
                    onChange={(e) => setFlow({ ...flow, scene: e.target.value as SceneArtboard })}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    {SCENE_ARTBOARDS.map((sc) => (
                      <option key={sc} value={sc}>
                        {SCENE_LABELS[sc]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flow-minutes" className="text-[11px] font-semibold text-slate-600">
                    Duration (min)
                  </Label>
                  <Input
                    id="flow-minutes"
                    type="number"
                    min={1}
                    max={30}
                    value={flow.maxMinutes}
                    onChange={(e) =>
                      setFlow({ ...flow, maxMinutes: Math.min(30, Math.max(1, Number(e.target.value) || 6)) })
                    }
                    className="h-8 bg-white text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-ink ring-1 ring-slate-200">
                  {TUTOR_STYLE_LABELS[flow.style]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {flow.maxMinutes} min
                </span>
                {savedScenario && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Saved ({savedScenario.status})
                  </span>
                )}
              </div>
            </div>

            <FlowStoryboard
              steps={flow.steps}
              onStepsChange={(next: FlowStep[]) => {
                setFlow({ ...flow, steps: next });
                setSavedScenario(null);
              }}
              onAiRevise={handleAiRevise}
              isRevising={revising}
              diff={diff}
              canUndo={Boolean(undoSnapshot)}
              onUndo={handleUndo}
              onDismissDiff={() => {
                setDiff(null);
                setUndoSnapshot(null);
              }}
            />

            <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="h-10 rounded-xl border-slate-300 text-xs font-bold text-ink"
              >
                <Play className="mr-1.5 h-3.5 w-3.5 text-brand-text" />
                Test as student
              </Button>
              <Button
                type="button"
                disabled={addingToLesson}
                onClick={handleAddToLesson}
                className="h-10 rounded-xl bg-ink text-xs font-bold text-white hover:bg-ink-hover"
              >
                {addingToLesson ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Add to lesson
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mid-lesson Teacher Moments (placed after chosen blocks) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-text" />
            <div>
              <h4 className="text-xs font-bold text-ink">Teacher moments ({moments.length})</h4>
              <p className="text-[11px] text-slate-500">
                Place short AI check-ins after specific lesson blocks.
              </p>
            </div>
          </div>
        </div>

        {!momentsAvailable ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900">
            Mid-lesson teacher moments will activate after applying migration{" "}
            <code className="font-mono">20261122000000_teacher_moments.sql</code>.
          </p>
        ) : (
          <>
            {moments.length > 0 && (
              <div className="space-y-2">
                {moments.map((m) => {
                  const afterIdx = blocks.findIndex((b) => b.id === m.after_block_id);
                  const anchorLabel =
                    m.after_block_id === null
                      ? "At start of lesson"
                      : afterIdx >= 0
                        ? `After ${blockLabel(blocks[afterIdx], afterIdx)}`
                        : "After block";
                  return (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {m.title || m.scenario_title || "Teacher moment"}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{anchorLabel}</p>
                      </div>
                      <button
                        type="button"
                        disabled={momentBusy}
                        onClick={() => handleDeleteMoment(m.id)}
                        aria-label={`Delete teacher moment ${m.title || ""}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {scenarios.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="moment-scenario" className="text-[11px] font-semibold text-slate-600">
                      Flow
                    </Label>
                    <select
                      id="moment-scenario"
                      value={momentScenarioId}
                      onChange={(e) => setMomentScenarioId(e.target.value)}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      {scenarios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="moment-after" className="text-[11px] font-semibold text-slate-600">
                      Position
                    </Label>
                    <select
                      id="moment-after"
                      value={momentAfterBlockId}
                      onChange={(e) => setMomentAfterBlockId(e.target.value)}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="">Start of lesson</option>
                      {blocks.map((b, i) => (
                        <option key={b.id} value={b.id}>
                          After {blockLabel(b, i)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={momentTitle}
                    onChange={(e) => setMomentTitle(e.target.value)}
                    placeholder="Moment label (optional, e.g. Quick check)"
                    aria-label="Moment label"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={momentBusy || !momentScenarioId}
                    onClick={handleAddMoment}
                    className="h-8 shrink-0 rounded-lg text-xs font-semibold"
                  >
                    <MessageSquareText className="mr-1 h-3.5 w-3.5 text-brand-text" />
                    Place
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Test as student Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Test AI Teacher as student</DialogTitle>
          <DialogDescription className="sr-only">
            Interactive student preview of your draft flow. No learner progress or report is saved.
          </DialogDescription>
          <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950">
            <span>Student preview — no learner progress or report is saved</span>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded px-2 py-0.5 text-amber-800 hover:bg-amber-100"
            >
              Close preview
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewOpen && flow && (
              <TutorSession
                origin="lesson"
                lessonId={lessonId}
                scenarioId={savedScenario?.id}
                scene={flow.scene}
                look={selectedPersona?.rive_variant}
                client={previewClient}
                preview={{
                  teacherName: selectedPersona?.display_name ?? selectedPersona?.name ?? "Tinashe",
                  title: flow.title,
                  goal: flow.goal,
                  maxMinutes: flow.maxMinutes,
                  modes: ["voice", "text"],
                }}
                onExit={() => setPreviewOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
