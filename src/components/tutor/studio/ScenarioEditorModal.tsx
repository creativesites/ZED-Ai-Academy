"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Play, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { FlowStoryboard } from "@/components/tutor/studio/FlowStoryboard";
import { createTeacherPreviewClient } from "@/components/tutor/studio/previewClient";
import type { DraftedFlow, FlowDiffEntry, FlowStep } from "@/lib/tutor/authoring/flow";
import type { PreviewFlowPayload } from "@/lib/tutor/authoring/preview";
import { AUTHORING_TEMPLATES, type AuthoringTemplateId } from "@/lib/tutor/authoring/templates";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import {
  ALL_SKILL_PACKS,
  SCENARIO_STYLES,
  type ScenarioStyle,
  type SkillPack,
} from "@/lib/tutor/scenario";
import { TUTOR_STYLE_LABELS } from "@/lib/tutor/tutor-session-block";
import {
  upsertScenario,
  type PersonaRecord,
  type ScenarioRecord,
} from "@/actions/tutor-authoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SKILL_PACK_LABELS: Record<SkillPack, string> = {
  "language-zh": "Mandarin Chinese (tones & pinyin)",
  "language-es": "Spanish (register & pronunciation)",
  "language-fr": "French (liaison & vowels)",
  "language-bem": "Bemba — Ichibemba (local Zambian)",
  "language-ny": "Nyanja — Chinyanja (local Zambian)",
  "language-tog": "Tonga — Chitonga (local Zambian)",
  "health-sim": "Healthcare / Clinical Role-Play",
  "general-tutor": "General Course Tutor",
};

const SCENE_LABELS: Record<SceneArtboard, string> = {
  Scene_TeaHouse: "Tea House",
  Scene_Cafe: "Café",
  Scene_Rooftop: "Rooftop",
  Scene_Clinic: "Clinic",
  Scene_Classroom: "Classroom",
  Scene_Studio: "Studio",
};

const EXAM_TEMPLATES: Array<{
  label: string;
  title: string;
  goal: string;
  skillPack: SkillPack;
  style: ScenarioStyle;
  scene: SceneArtboard;
  level: string;
  maxMinutes: number;
  beats: Array<{ id: string; goal: string }>;
  targetItems: Array<{ text: string; pron?: string; meaning?: string }>;
}> = [
  {
    label: "HSKK Beginner (Mandarin)",
    title: "HSKK Beginner Oral Check: Self-Introduction & Daily Routine",
    goal: "Answer short personal questions clearly with accurate tones and complete HSK1-2 sentences.",
    skillPack: "language-zh",
    style: "oral_check",
    scene: "Scene_TeaHouse",
    level: "HSK1",
    maxMinutes: 6,
    beats: [
      { id: "beat-1", goal: "Greet the learner and ask their name and where they are from." },
      { id: "beat-2", goal: "Ask two short questions about their daily routine or favourite food." },
      { id: "beat-3", goal: "Give brief encouraging tone feedback and close the oral check." },
    ],
    targetItems: [
      { text: "你好，我叫…", pron: "nǐ hǎo, wǒ jiào...", meaning: "Hello, my name is..." },
      { text: "我每天…", pron: "wǒ měitiān...", meaning: "Every day I..." },
      { text: "谢谢老师", pron: "xièxie lǎoshī", meaning: "Thank you, teacher" },
    ],
  },
  {
    label: "DELE A1 Oral (Spanish)",
    title: "DELE A1 Role-Play: Ordering at a Café",
    goal: "Greet the server politely, order a drink and snack, and ask for the bill using A1 Spanish.",
    skillPack: "language-es",
    style: "oral_check",
    scene: "Scene_Cafe",
    level: "A1",
    maxMinutes: 6,
    beats: [
      { id: "beat-1", goal: "Welcome the learner to the café and ask what they would like." },
      { id: "beat-2", goal: "Confirm their order and offer a small follow-up choice." },
      { id: "beat-3", goal: "Handle the bill and polite goodbye." },
    ],
    targetItems: [
      { text: "Quisiera un café, por favor", pron: "kee-SYEH-rah oon kah-FEH", meaning: "I would like a coffee, please" },
      { text: "La cuenta, por favor", pron: "lah KWEHN-tah", meaning: "The bill, please" },
    ],
  },
  {
    label: "DELF A1 Oral (French)",
    title: "DELF A1 Dialogue: At the Bakery",
    goal: "Use polite French (vous), request items at a bakery, and understand the price.",
    skillPack: "language-fr",
    style: "oral_check",
    scene: "Scene_Rooftop",
    level: "A1",
    maxMinutes: 6,
    beats: [
      { id: "beat-1", goal: "Greet with Bonjour and ask what the customer wants." },
      { id: "beat-2", goal: "Respond to their request and state the total price." },
      { id: "beat-3", goal: "Complete the purchase and say Au revoir." },
    ],
    targetItems: [
      { text: "Je voudrais un croissant", pron: "zhuh voo-DREH uhn krwah-SAHN", meaning: "I would like a croissant" },
      { text: "C'est combien ?", pron: "seh kohm-BYEN", meaning: "How much is it?" },
    ],
  },
  {
    label: "Course Concept Walkthrough",
    title: "Guided Concept Check & Interactive Q&A",
    goal: "Walk through the lesson's key concept step by step using quick-tap checkpoints and examples.",
    skillPack: "general-tutor",
    style: "guided_lesson",
    scene: "Scene_Classroom",
    level: "All levels",
    maxMinutes: 8,
    beats: [
      { id: "beat-1", goal: "Introduce the main idea clearly in 2 short sentences." },
      { id: "beat-2", goal: "Check understanding with a multiple-choice question on the board." },
      { id: "beat-3", goal: "Share a real-world example and summarize the takeaway." },
    ],
    targetItems: [],
  },
];

type TargetItemRow = { text: string; pron?: string; meaning?: string };

export function ScenarioEditorModal({
  open,
  onOpenChange,
  companyId,
  courseId,
  lessonId,
  personas,
  initialScenario,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  courseId?: string | null;
  lessonId?: string | null;
  personas: PersonaRecord[];
  initialScenario?: ScenarioRecord | null;
  onSaved: (saved: ScenarioRecord) => void;
}) {
  const [title, setTitle] = useState(initialScenario?.title ?? "");
  const [goal, setGoal] = useState(initialScenario?.goal ?? "");
  const [skillPack, setSkillPack] = useState<SkillPack>(
    (initialScenario?.skill_pack as SkillPack) ?? "general-tutor"
  );
  const [personaId, setPersonaId] = useState<string>(
    initialScenario?.persona_id ?? personas[0]?.id ?? ""
  );
  const [style, setStyle] = useState<ScenarioStyle>(initialScenario?.style ?? "guided_lesson");
  const [scene, setScene] = useState<SceneArtboard>(initialScenario?.scene ?? "Scene_Classroom");
  const [level, setLevel] = useState(initialScenario?.level ?? "");
  const [maxMinutes, setMaxMinutes] = useState(initialScenario?.max_minutes ?? 7);
  const [visibility, setVisibility] = useState<"course" | "tenant_library" | "platform">(
    initialScenario?.visibility ?? (courseId ? "course" : "tenant_library")
  );
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    initialScenario?.status ?? "published"
  );
  const [voiceAllowed, setVoiceAllowed] = useState(
    initialScenario ? initialScenario.allowed_modes.includes("voice") : true
  );
  const [textAllowed, setTextAllowed] = useState(
    initialScenario ? initialScenario.allowed_modes.includes("text") : true
  );
  const [beats, setBeats] = useState<FlowStep[]>(
    initialScenario?.beats.length
      ? initialScenario.beats.map((b) => ({
          id: b.id,
          goal: b.goal,
          boardContent: b.boardContent ?? "",
          checkQuestion: b.checkQuestion ?? "",
          ...(b.targetItems?.length ? { targetItems: b.targetItems } : {}),
        }))
      : [
          {
            id: "step-1",
            goal: "Introduce the idea and connect it to everyday life",
            boardContent: "",
            checkQuestion: "",
          },
          {
            id: "step-2",
            goal: "Practise the key concepts with a worked example",
            boardContent: "",
            checkQuestion: "",
          },
          {
            id: "step-3",
            goal: "Check understanding and wrap up",
            boardContent: "",
            checkQuestion: "",
          },
        ]
  );
  const [targetItems, setTargetItems] = useState<TargetItemRow[]>(
    initialScenario?.target_items ?? []
  );
  const [templateId, setTemplateId] = useState<AuthoringTemplateId>("explain_check");
  const [aiNotes, setAiNotes] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<DraftedFlow | null>(null);
  const [diff, setDiff] = useState<FlowDiffEntry[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const selectedPersona = personas.find((p) => p.id === personaId) ?? null;

  const previewFlow = useMemo<PreviewFlowPayload>(
    () => ({
      scenarioId: initialScenario?.id ?? null,
      courseId: courseId ?? initialScenario?.course_id ?? null,
      lessonId: lessonId ?? initialScenario?.lesson_id ?? null,
      companyId,
      personaId: personaId || null,
      title: title.trim() || "Draft AI Teacher flow",
      goal: goal.trim() || "Practise this lesson interactively.",
      style,
      scene,
      maxMinutes,
      skillPack,
      level: level.trim() || null,
      steps: beats,
      targetItems,
    }),
    [
      initialScenario?.id,
      initialScenario?.course_id,
      initialScenario?.lesson_id,
      courseId,
      lessonId,
      companyId,
      personaId,
      title,
      goal,
      style,
      scene,
      maxMinutes,
      skillPack,
      level,
      beats,
      targetItems,
    ],
  );

  const previewClient = useMemo(
    () => createTeacherPreviewClient(() => previewFlow),
    [previewFlow],
  );

  function currentAsDraftedFlow(): DraftedFlow {
    return {
      title: title.trim() || "Untitled flow",
      goal: goal.trim() || "Guide the learner through the key concepts.",
      style,
      scene,
      maxMinutes,
      skillPack,
      steps: beats.length
        ? beats
        : [
            { id: "step-1", goal: "Intro", boardContent: "", checkQuestion: "" },
            { id: "step-2", goal: "Practice", boardContent: "", checkQuestion: "" },
            { id: "step-3", goal: "Check", boardContent: "", checkQuestion: "" },
          ],
      targetItems,
    };
  }

  function applyDraftedFlow(next: DraftedFlow) {
    setTitle(next.title);
    setGoal(next.goal);
    setStyle(next.style);
    setScene(next.scene);
    setMaxMinutes(next.maxMinutes);
    setSkillPack(next.skillPack);
    setBeats(next.steps);
    setTargetItems(next.targetItems);
  }

  async function handleAiRevise(instruction: string) {
    if (!courseId) {
      toast.error("AI revision requires a course context.");
      return;
    }
    const before = currentAsDraftedFlow();
    setIsRevising(true);
    try {
      const res = await fetch("/api/ai/teacher/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId: lessonId ?? undefined,
          flow: before,
          instruction,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        flow?: DraftedFlow;
        diff?: FlowDiffEntry[];
      };
      if (!res.ok || !data.flow) {
        throw new Error(data.error || "Could not revise flow");
      }
      setUndoSnapshot(before);
      setDiff(data.diff ?? []);
      applyDraftedFlow(data.flow);
      toast.success("Flow updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI edit failed");
    } finally {
      setIsRevising(false);
    }
  }

  async function handleAiDraft() {
    if (!courseId) {
      toast.error("AI drafting works inside a course or lesson.");
      return;
    }
    setIsDrafting(true);
    try {
      const res = await fetch("/api/ai/generate-tutor-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId: lessonId ?? undefined,
          skillPack,
          style,
          level,
          templateId,
          instructions: aiNotes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        scenario?: {
          title: string;
          goal: string;
          level?: string;
          max_minutes?: number;
          scene?: SceneArtboard;
          beats?: { id: string; goal: string; boardContent?: string; checkQuestion?: string; targetItems?: string[] }[];
          target_items?: TargetItemRow[];
        };
      };
      if (!res.ok || !data.scenario) {
        throw new Error(data.error || "Could not generate scenario");
      }
      setTitle(data.scenario.title);
      setGoal(data.scenario.goal);
      if (data.scenario.level) setLevel(data.scenario.level);
      if (data.scenario.max_minutes) setMaxMinutes(data.scenario.max_minutes);
      if (data.scenario.scene) setScene(data.scenario.scene);
      if (data.scenario.beats?.length) {
        setBeats(
          data.scenario.beats.map((b, idx) => ({
            id: b.id || `step-${idx + 1}`,
            goal: b.goal,
            boardContent: b.boardContent ?? "",
            checkQuestion: b.checkQuestion ?? "",
            ...(b.targetItems?.length ? { targetItems: b.targetItems } : {}),
          }))
        );
      }
      if (data.scenario.target_items?.length) setTargetItems(data.scenario.target_items);
      toast.success("AI drafted your flow!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setIsDrafting(false);
    }
  }

  function handleSave() {
    if (!title.trim() || !goal.trim()) {
      toast.error("Please provide both a title and a learner goal.");
      return;
    }
    const allowedModes: ("voice" | "text")[] = [];
    if (voiceAllowed) allowedModes.push("voice");
    if (textAllowed) allowedModes.push("text");
    if (allowedModes.length === 0) allowedModes.push("text");

    const cleanBeats = beats
      .map((b, i) => ({
        id: b.id.trim() || `step-${i + 1}`,
        goal: b.goal.trim(),
        ...(b.boardContent.trim() ? { boardContent: b.boardContent.trim() } : {}),
        ...(b.checkQuestion.trim() ? { checkQuestion: b.checkQuestion.trim() } : {}),
        ...(b.targetItems?.length ? { targetItems: b.targetItems } : {}),
      }))
      .filter((b) => b.goal.length > 0);

    const cleanItems = targetItems
      .map((item) => ({
        text: item.text.trim(),
        ...(item.pron?.trim() ? { pron: item.pron.trim() } : {}),
        ...(item.meaning?.trim() ? { meaning: item.meaning.trim() } : {}),
      }))
      .filter((item) => item.text.length > 0);

    startSaving(async () => {
      try {
        const saved = await upsertScenario({
          id: initialScenario?.id,
          companyId,
          courseId: courseId ?? initialScenario?.course_id ?? null,
          lessonId: lessonId ?? initialScenario?.lesson_id ?? null,
          skillPack,
          personaId: personaId || null,
          title: title.trim(),
          goal: goal.trim(),
          beats: cleanBeats,
          targetItems: cleanItems,
          level: level.trim() || null,
          maxMinutes,
          allowedModes,
          scene,
          visibility,
          style,
          status,
        });
        toast.success(`Scenario "${saved.title}" saved!`);
        onSaved(saved);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save scenario");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-[#062e39]">
            <Sparkles className="h-5 w-5 text-[#fd5523]" />
            {initialScenario ? "Edit AI Teacher Flow" : "Create AI Teacher Flow"}
          </DialogTitle>
          <DialogDescription>
            Configure the animated AI teacher, role-play beats, and target phrases for this interactive session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* One-click Exam & Subject Starter Templates */}
          {!initialScenario && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick-Start Exam &amp; Lesson Templates
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {EXAM_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => {
                      setTitle(tpl.title);
                      setGoal(tpl.goal);
                      setSkillPack(tpl.skillPack);
                      setStyle(tpl.style);
                      setScene(tpl.scene);
                      setLevel(tpl.level);
                      setMaxMinutes(tpl.maxMinutes);
                      setBeats(
                        tpl.beats.map((b) => ({
                          ...b,
                          boardContent: "",
                          checkQuestion: "",
                        })),
                      );
                      setTargetItems(tpl.targetItems);
                      toast.success(`Loaded "${tpl.label}" template`);
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#fd5523]/50 hover:bg-[#fff6ee] hover:text-[#fd5523]"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Quick Draft Bar (when inside a course/lesson) */}
          {courseId && (
            <div className="space-y-2 rounded-2xl border border-[#fd5523]/25 bg-[#fff6ee] p-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {AUTHORING_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    aria-pressed={templateId === tpl.id}
                    onClick={() => {
                      setTemplateId(tpl.id);
                      setStyle(tpl.style);
                      setScene(tpl.defaultScene);
                      setMaxMinutes(tpl.maxMinutes);
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      templateId === tpl.id
                        ? "bg-[#fd5523] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-[#fd5523]/40"
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Optional AI focus (e.g. 'Worked example on kwacha discounts')"
                  className="bg-white text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isDrafting}
                  onClick={handleAiDraft}
                  className="shrink-0 rounded-xl bg-[#fd5523] text-xs font-bold text-white hover:bg-[#ea4817]"
                >
                  {isDrafting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Draft with AI
                </Button>
              </div>
            </div>
          )}

          {/* Persona Preview + Core Selectors */}
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-b from-[#1a1338] to-[#321b4e] p-2">
              <Teacher
                variant="bust"
                persona={selectedPersona?.rive_variant ?? DEFAULT_PERSONA_LOOK}
                className="h-24 w-24"
                label="Selected AI teacher"
              />
              <span className="mt-1 truncate text-[10px] font-bold text-amber-200">
                {selectedPersona?.display_name || selectedPersona?.name || "Default Teacher"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">AI Teacher Persona</Label>
                <select
                  value={personaId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPersonaId(nextId);
                    const p = personas.find((x) => x.id === nextId);
                    if (p?.default_scene) setScene(p.default_scene);
                  }}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Default animated teacher</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.name} ({p.languages.join(", ") || "all"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Skill Pack</Label>
                <select
                  value={skillPack}
                  onChange={(e) => setSkillPack(e.target.value as SkillPack)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {ALL_SKILL_PACKS.map((sp) => (
                    <option key={sp} value={sp}>
                      {SKILL_PACK_LABELS[sp]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Rive Backdrop Scene</Label>
                <select
                  value={scene}
                  onChange={(e) => setScene(e.target.value as SceneArtboard)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {SCENE_ARTBOARDS.map((s) => (
                    <option key={s} value={s}>
                      {SCENE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Session Style</Label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as ScenarioStyle)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {SCENARIO_STYLES.map((st) => (
                    <option key={st} value={st}>
                      {TUTOR_STYLE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Title & Goal */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Scenario Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Greetings & Ordering Tea at the Tea House"
                maxLength={140}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Learner Goal *</Label>
              <Textarea
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What should the learner accomplish out loud by the end of this conversation?"
                maxLength={600}
              />
            </div>
          </div>

          {/* Level, Time, Visibility, Status */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Level</Label>
              <Input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="HSK1 / A1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Max Minutes</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={maxMinutes}
                onChange={(e) => setMaxMinutes(Math.min(30, Math.max(1, Number(e.target.value) || 6)))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Visibility</Label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "course" | "tenant_library")}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
              >
                {courseId && <option value="course">This course only</option>}
                <option value="tenant_library">Academy Teacher&apos;s Room</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Modes */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
            <span>Allowed modes:</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={voiceAllowed}
                onChange={(e) => setVoiceAllowed(e.target.checked)}
                className="accent-[#fd5523]"
              />
              Voice (hold to talk)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={textAllowed}
                onChange={(e) => setTextAllowed(e.target.checked)}
                className="accent-[#fd5523]"
              />
              Text chat
            </label>
          </div>

          {/* Storyboard Steps + AI Edit Bar */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <FlowStoryboard
              steps={beats}
              onStepsChange={setBeats}
              onAiRevise={courseId ? handleAiRevise : undefined}
              isRevising={isRevising}
              diff={diff}
              canUndo={Boolean(undoSnapshot)}
              onUndo={() => {
                if (!undoSnapshot) return;
                applyDraftedFlow(undoSnapshot);
                setUndoSnapshot(null);
                setDiff(null);
                toast.success("Reverted to previous version");
              }}
              onDismissDiff={() => {
                setDiff(null);
                setUndoSnapshot(null);
              }}
            />
          </div>

          {/* Target Vocabulary / Phrases */}
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Target Phrases / Flashcards ({targetItems.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTargetItems((prev) => [...prev, { text: "", pron: "", meaning: "" }])
                }
                className="h-7 rounded-lg text-xs"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Phrase
              </Button>
            </div>
            {targetItems.length === 0 ? (
              <p className="text-xs text-slate-400">
                Optional: add key vocabulary words or expressions the AI teacher should display on flashcards.
              </p>
            ) : (
              <div className="space-y-2">
                {targetItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) =>
                        setTargetItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, text: e.target.value } : r))
                        )
                      }
                      placeholder="Word / Phrase"
                      className="bg-white text-xs"
                    />
                    <Input
                      value={item.pron ?? ""}
                      onChange={(e) =>
                        setTargetItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, pron: e.target.value } : r))
                        )
                      }
                      placeholder="Pinyin / Pronunciation"
                      className="bg-white text-xs"
                    />
                    <Input
                      value={item.meaning ?? ""}
                      onChange={(e) =>
                        setTargetItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, meaning: e.target.value } : r))
                        )
                      }
                      placeholder="Meaning"
                      className="bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setTargetItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove phrase"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              className="rounded-xl text-xs font-bold text-[#062e39]"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 text-[#fd5523]" />
              Test as student
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-xl bg-[#062e39] px-6 font-bold text-white hover:bg-[#0a4352]"
              >
                {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {initialScenario ? "Save Changes" : "Create Scenario"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Test AI Teacher as student</DialogTitle>
          <DialogDescription className="sr-only">
            Preview session. No learner progress or report is saved.
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
            {previewOpen && (
              <TutorSession
                origin={courseId && lessonId ? "lesson" : "practice"}
                lessonId={lessonId ?? undefined}
                scenarioId={initialScenario?.id}
                scene={scene}
                look={selectedPersona?.rive_variant}
                client={previewClient}
                preview={{
                  teacherName: selectedPersona?.display_name ?? selectedPersona?.name ?? "AI Teacher",
                  title: title.trim() || "Draft AI Teacher flow",
                  goal: goal.trim() || "Practise this flow interactively.",
                  maxMinutes,
                  modes: ["voice", "text"],
                }}
                onExit={() => setPreviewOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
