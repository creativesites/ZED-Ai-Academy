"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import {
  SCENARIO_STYLES,
  SKILL_PACKS,
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
  "health-sim": "Healthcare / Clinical Role-Play",
  "general-tutor": "General Course Tutor",
};

const SCENE_LABELS: Record<SceneArtboard, string> = {
  Scene_TeaHouse: "Tea House",
  Scene_Cafe: "Café",
  Scene_Rooftop: "Rooftop",
  Scene_Clinic: "Clinic",
};

type BeatRow = { id: string; goal: string; targetItems?: string[] };
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
    (initialScenario?.skill_pack as SkillPack) ?? "language-zh"
  );
  const [personaId, setPersonaId] = useState<string>(
    initialScenario?.persona_id ?? personas[0]?.id ?? ""
  );
  const [style, setStyle] = useState<ScenarioStyle>(initialScenario?.style ?? "scene");
  const [scene, setScene] = useState<SceneArtboard>(initialScenario?.scene ?? "Scene_TeaHouse");
  const [level, setLevel] = useState(initialScenario?.level ?? "A1");
  const [maxMinutes, setMaxMinutes] = useState(initialScenario?.max_minutes ?? 6);
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
  const [beats, setBeats] = useState<BeatRow[]>(
    initialScenario?.beats.length
      ? initialScenario.beats
      : [
          { id: "beat-1", goal: "Greet the learner and introduce the situation" },
          { id: "beat-2", goal: "Practise the key phrases in a short back-and-forth" },
          { id: "beat-3", goal: "Wrap up and praise what went well" },
        ]
  );
  const [targetItems, setTargetItems] = useState<TargetItemRow[]>(
    initialScenario?.target_items ?? []
  );
  const [aiNotes, setAiNotes] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const selectedPersona = personas.find((p) => p.id === personaId) ?? null;

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
          beats?: BeatRow[];
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
      if (data.scenario.beats?.length) setBeats(data.scenario.beats);
      if (data.scenario.target_items?.length) setTargetItems(data.scenario.target_items);
      toast.success("AI drafted your speaking scenario!");
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
        id: b.id.trim() || `beat-${i + 1}`,
        goal: b.goal.trim(),
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
            {initialScenario ? "Edit Speaking Scenario" : "Create AI Teacher Speaking Scenario"}
          </DialogTitle>
          <DialogDescription>
            Configure the animated AI teacher, role-play beats, and target phrases for this interactive session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* AI Quick Draft Bar (when inside a course/lesson) */}
          {courseId && (
            <div className="rounded-2xl border border-[#fd5523]/25 bg-[#fff6ee] p-3.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Optional AI focus (e.g. 'Ordering tea using polite HSK1 greetings')"
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
                  {SKILL_PACKS.map((sp) => (
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
                <option value="tenant_library">Academy Practice Room</option>
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

          {/* Conversation Beats */}
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Conversation Beats ({beats.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setBeats((prev) => [...prev, { id: `beat-${prev.length + 1}`, goal: "" }])
                }
                className="h-7 rounded-lg text-xs"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Beat
              </Button>
            </div>
            <div className="space-y-2">
              {beats.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">
                    {idx + 1}.
                  </span>
                  <Input
                    value={b.goal}
                    onChange={(e) =>
                      setBeats((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, goal: e.target.value } : row))
                      )
                    }
                    placeholder="Step goal for the AI teacher..."
                    className="bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setBeats((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove beat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
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
      </DialogContent>
    </Dialog>
  );
}
