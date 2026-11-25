"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  Wand2,
  Check,
  Loader2,
  Hand,
  Volume2,
  Palette,
} from "lucide-react";
import { TeacherStage, type TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import {
  ALL_PERSONA_PRESETS,
  type AnyPersonaPresetKey,
} from "@/components/tutor/avatar/persona-presets";
import { DEFAULT_PERSONA_LOOK, type PersonaLook } from "@/components/tutor/avatar/types";
import { applyBrandColorsToLook } from "@/lib/tutor/branding";
import {
  applyPronunciationGlossary,
  formatPronunciationGlossary,
  parsePronunciationGlossary,
} from "@/lib/tutor/pronunciation";
import {
  FACE_STYLES,
  HAIR_STYLES,
  OUTFIT_STYLES,
  PROPS,
  type Gesture,
  type Mood,
} from "@/lib/tutor/contract.generated";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import {
  deletePersona,
  getTenantBrandColor,
  seedStarterPersonas,
  upsertPersona,
  type PersonaRecord,
} from "@/actions/tutor-authoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const GEMINI_VOICES = [
  { name: "Kore", label: "Kore — Warm & clear (Female)" },
  { name: "Aoede", label: "Aoede — Expressive & bright (Female)" },
  { name: "Leda", label: "Leda — Gentle & articulate (Female)" },
  { name: "Sulafat", label: "Sulafat — Calm & steady (Female)" },
  { name: "Puck", label: "Puck — Friendly & energetic (Male)" },
  { name: "Charon", label: "Charon — Deep & reassuring (Male)" },
  { name: "Fenrir", label: "Fenrir — Direct & clear (Male)" },
];

const SCENE_LABELS: Record<SceneArtboard, string> = {
  Scene_TeaHouse: "Tea House (Warm daylight)",
  Scene_Cafe: "Seville Café",
  Scene_Rooftop: "Paris Rooftop",
  Scene_Clinic: "Modern Clinic",
  Scene_Classroom: "Classroom (any subject)",
  Scene_Studio: "Studio (any subject)",
};

const COLOR_FIELDS: Array<{ key: keyof PersonaLook; label: string }> = [
  { key: "skinColor", label: "Skin" },
  { key: "skinShadeColor", label: "Skin Shade" },
  { key: "hairColor", label: "Hair" },
  { key: "outfitPrimary", label: "Outfit" },
  { key: "outfitSecondary", label: "Blouse / Trim" },
  { key: "accentColor", label: "Accent" },
];

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English (en)" },
  { code: "bem", label: "Bemba (bem)" },
  { code: "ny", label: "Nyanja (ny)" },
  { code: "tog", label: "Tonga (tog)" },
  { code: "zh", label: "Mandarin (zh)" },
  { code: "es", label: "Spanish (es)" },
  { code: "fr", label: "French (fr)" },
];

const QUICK_GESTURES: Array<{ gesture: Gesture; label: string }> = [
  { gesture: "wave", label: "Wave" },
  { gesture: "explain", label: "Explain" },
  { gesture: "thumbs_up", label: "Thumbs up" },
  { gesture: "celebrate", label: "Celebrate" },
];

type EditorDraft = {
  id?: string;
  name: string;
  displayName: string;
  languages: string[];
  look: PersonaLook;
  voiceName: string;
  speakingRate: number;
  pronunciationGlossaryText: string;
  personalityPrompt: string;
  defaultScene: SceneArtboard;
  isActive: boolean;
};

function draftFromRecord(p: PersonaRecord): EditorDraft {
  return {
    id: p.id,
    name: p.name,
    displayName: p.display_name ?? p.name,
    languages: p.languages.length > 0 ? p.languages : ["en"],
    look: { ...DEFAULT_PERSONA_LOOK, ...p.rive_variant },
    voiceName: p.voice.voiceName ?? "Kore",
    speakingRate: p.voice.speakingRate ?? 1.0,
    pronunciationGlossaryText: formatPronunciationGlossary(p.voice.pronunciationGlossary ?? []),
    personalityPrompt: p.personality_prompt,
    defaultScene: p.default_scene ?? "Scene_TeaHouse",
    isActive: p.is_active,
  };
}

function emptyDraft(): EditorDraft {
  return {
    name: "",
    displayName: "",
    languages: ["zh", "en"],
    look: { ...DEFAULT_PERSONA_LOOK },
    voiceName: "Kore",
    speakingRate: 1.0,
    pronunciationGlossaryText: "",
    personalityPrompt:
      "You are a warm, encouraging AI teacher at our academy. Keep turns short, guide learners step by step, and celebrate progress.",
    defaultScene: "Scene_TeaHouse",
    isActive: true,
  };
}

export function PersonaStudio({
  companyId,
  initialPersonas,
  onPersonasChange,
}: {
  companyId: string;
  initialPersonas: PersonaRecord[];
  onPersonasChange?: (next: PersonaRecord[]) => void;
}) {
  const stageRef = useRef<TeacherStageHandle | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [personas, setPersonas] = useState<PersonaRecord[]>(initialPersonas);
  const [selectedId, setSelectedId] = useState<string | "new">(
    initialPersonas[0]?.id ?? "new"
  );
  const [draft, setDraft] = useState<EditorDraft>(() =>
    initialPersonas[0] ? draftFromRecord(initialPersonas[0]) : emptyDraft()
  );
  const [isSaving, startSaving] = useTransition();
  const [isSeeding, startSeeding] = useTransition();
  const [brandColor, setBrandColor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTenantBrandColor(companyId)
      .then((color) => {
        if (active && color) setBrandColor(color);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [companyId]);

  function applyAcademyBranding() {
    if (!brandColor) {
      toast.error("Set an academy primary brand color in Settings first.");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      look: applyBrandColorsToLook(prev.look, { primaryColor: brandColor }),
    }));
    stageRef.current?.playGesture("nod");
    toast.success(`Applied academy color (${brandColor}) to teacher outfit`);
  }

  function updateList(next: PersonaRecord[]) {
    setPersonas(next);
    onPersonasChange?.(next);
  }

  function selectPersona(p: PersonaRecord) {
    setSelectedId(p.id);
    setDraft(draftFromRecord(p));
  }

  function startNewPersona() {
    setSelectedId("new");
    setDraft(emptyDraft());
  }

  function applyPreset(key: AnyPersonaPresetKey) {
    const preset = ALL_PERSONA_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setDraft((prev) => ({
      ...prev,
      name: prev.name || preset.label,
      displayName: prev.displayName || preset.label,
      look: { ...preset.look },
    }));
    stageRef.current?.playGesture("wave");
  }

  function toggleLanguage(code: string) {
    setDraft((prev) => {
      const has = prev.languages.includes(code);
      const next = has ? prev.languages.filter((l) => l !== code) : [...prev.languages, code];
      return { ...prev, languages: next.length > 0 ? next : [code] };
    });
  }

  async function handleTestVoice() {
    if (testingVoice) return;
    setTestingVoice(true);
    const glossary = parsePronunciationGlossary(draft.pronunciationGlossaryText);
    const sampleRaw = `Hello! I'm ${draft.displayName.trim() || draft.name.trim() || "your AI teacher"}.${
      glossary.length > 0 ? ` Today we'll practise ${glossary.slice(0, 3).map((g) => g.term).join(", ")}.` : " Ready to learn step by step?"
    }`;
    const spoken = applyPronunciationGlossary(sampleRaw, glossary);
    try {
      const res = await fetch("/api/tutor/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text: spoken, voice: draft.voiceName, companyId }),
      });
      const data = (await res.json().catch(() => null)) as { url?: unknown } | null;
      if (typeof data?.url === "string" && data.url) {
        if (!voicePreviewAudioRef.current) voicePreviewAudioRef.current = new Audio();
        const el = voicePreviewAudioRef.current;
        el.src = data.url;
        el.playbackRate = Math.max(0.7, Math.min(1.3, draft.speakingRate));
        stageRef.current?.setSpeaking(true);
        stageRef.current?.playGesture("wave");
        el.onended = () => {
          stageRef.current?.setSpeaking(false);
          setTestingVoice(false);
        };
        el.onerror = () => {
          stageRef.current?.setSpeaking(false);
          setTestingVoice(false);
        };
        await el.play();
        return;
      }
      toast.info("Live TTS preview unavailable — check Gemini TTS configuration.");
      setTestingVoice(false);
    } catch {
      stageRef.current?.setSpeaking(false);
      setTestingVoice(false);
      toast.error("Could not preview voice right now.");
    }
  }

  function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Please enter a teacher name.");
      return;
    }
    startSaving(async () => {
      try {
        const saved = await upsertPersona({
          id: draft.id,
          companyId,
          name: draft.name.trim(),
          displayName: draft.displayName.trim() || draft.name.trim(),
          languages: draft.languages,
          look: draft.look,
          voiceName: draft.voiceName,
          speakingRate: draft.speakingRate,
          pronunciationGlossary: parsePronunciationGlossary(draft.pronunciationGlossaryText),
          personalityPrompt: draft.personalityPrompt.trim(),
          defaultScene: draft.defaultScene,
          isActive: draft.isActive,
        });

        const next = personas.some((p) => p.id === saved.id)
          ? personas.map((p) => (p.id === saved.id ? saved : p))
          : [...personas, saved];
        updateList(next);
        setSelectedId(saved.id);
        setDraft(draftFromRecord(saved));
        toast.success(`Saved AI teacher "${saved.display_name || saved.name}"`);
        stageRef.current?.playGesture("celebrate");
        stageRef.current?.celebrate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save AI teacher");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this AI teacher persona? Existing scenarios using it will keep working with a default look.")) {
      return;
    }
    startSaving(async () => {
      try {
        await deletePersona(companyId, id);
        const next = personas.filter((p) => p.id !== id);
        updateList(next);
        if (next[0]) {
          selectPersona(next[0]);
        } else {
          startNewPersona();
        }
        toast.success("AI teacher deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete AI teacher");
      }
    });
  }

  function handleSeedCast() {
    startSeeding(async () => {
      try {
        const updated = await seedStarterPersonas(companyId);
        updateList(updated);
        if (updated[0] && selectedId === "new") {
          selectPersona(updated[0]);
        }
        toast.success("Starter AI teacher cast ready!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add starter cast");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top cast bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Your Academy&apos;s Animated AI Teachers</h2>
          <p className="text-xs text-slate-500">
            Customize appearance, 3D/Rive scene backdrop, voice, and teaching personality. Used across courses and the Teacher&apos;s Room.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSeeding}
            onClick={handleSeedCast}
            className="rounded-xl border-slate-200 text-xs font-bold"
          >
            {isSeeding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5 text-brand-text" />}
            Import Starter Cast (5)
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={startNewPersona}
            className="rounded-xl bg-brand text-xs font-bold text-white hover:bg-brand-hover"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New AI Teacher
          </Button>
        </div>
      </div>

      {/* Persona selector pills */}
      {personas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {personas.map((p) => {
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPersona(p)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? "border-brand bg-brand-soft text-brand-text shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: p.rive_variant.outfitPrimary ?? "#2FA37F" }}
                />
                <span>{p.display_name || p.name}</span>
                {!p.is_active && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">Inactive</span>
                )}
              </button>
            );
          })}
          {selectedId === "new" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand-text">
              <Sparkles className="h-3.5 w-3.5" />
              New Teacher Draft
            </span>
          )}
        </div>
      )}

      {/* Main Split: Live Rive Stage + Controls */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Live Rive Preview Stage */}
        <div className="space-y-4">
          <div className="relative h-[440px] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-[#160f36] via-[#2a1745] to-[#40204d] shadow-xl">
            <TeacherStage
              ref={stageRef}
              engine={draft.look.engine ?? "rive"}
              scene={draft.defaultScene}
              persona={draft.look}
              ambience
              wrapClassName="absolute inset-0 flex items-end justify-center pt-10"
              teacherClassName="h-[390px] w-full max-w-[340px]"
              label={`${draft.displayName || draft.name || "AI Teacher"} live preview`}
            />
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200 backdrop-blur-sm">
                {draft.look.engine === "three" ? "3D WebGL Avatar" : "Live Animated Model"}
              </span>
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/45 px-4 py-2.5 text-center backdrop-blur-md">
              <p className="text-sm font-bold text-white">
                {draft.displayName || draft.name || "Unnamed Teacher"}
              </p>
              <p className="text-[11px] text-amber-200/90">
                {SCENE_LABELS[draft.defaultScene]} · Voice: {draft.voiceName}
              </p>
            </div>
          </div>

          {/* Quick animation test controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Hand className="h-3.5 w-3.5 text-brand-text" />
                Test Gestures & Mood
              </span>
              <div className="flex gap-1.5">
                {(["warm", "happy", "curious", "proud"] as Mood[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => stageRef.current?.setMood(m, 80)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 hover:bg-slate-50"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_GESTURES.map((g) => (
                <button
                  key={g.gesture}
                  type="button"
                  onClick={() => {
                    stageRef.current?.playGesture(g.gesture);
                    if (g.gesture === "celebrate") stageRef.current?.celebrate();
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-text"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customization Form */}
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {/* Quick Character Base Presets & Academy Branding */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Start from Character Base
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyAcademyBranding}
                className="h-7 rounded-lg text-[11px] font-bold text-ink"
              >
                <Palette className="mr-1 h-3 w-3 text-brand-text" />
                {brandColor ? `Apply Academy Brand (${brandColor})` : "Apply Academy Brand Colors"}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_PERSONA_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand hover:bg-brand-soft"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: preset.look.outfitPrimary }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Teacher Name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Lín Lǎoshī"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Display Name</Label>
              <Input
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                placeholder="Shown to learners"
              />
            </div>
          </div>

          {/* Languages & Scene */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Languages Taught</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const selected = draft.languages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-brand bg-brand-soft text-brand-text"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Default Backdrop Scene</Label>
              <select
                value={draft.defaultScene}
                onChange={(e) => setDraft((d) => ({ ...d, defaultScene: e.target.value as SceneArtboard }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                {SCENE_ARTBOARDS.map((s) => (
                  <option key={s} value={s}>
                    {SCENE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Appearance Controls */}
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Palette className="h-3.5 w-3.5 text-brand-text" />
                3D / Rive Model Styling
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                {(
                  [
                    { id: "rive", label: "Rive 2.5D" },
                    { id: "three", label: "3D WebGL" },
                  ] as const
                ).map((opt) => {
                  const active = (draft.look.engine ?? "rive") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, look: { ...d.look, engine: opt.id } }))
                      }
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        active ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {draft.look.engine === "three" && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Custom 3D .glb Model URL (optional — Ready Player Me, Avaturn, or Blender)
                </Label>
                <Input
                  value={draft.look.glbUrl ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      look: { ...d.look, glbUrl: e.target.value || undefined },
                    }))
                  }
                  placeholder="Leave blank to use the built-in stylized 3D teacher"
                  className="bg-white text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Face
                <select
                  value={draft.look.faceStyle}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, look: { ...d.look, faceStyle: e.target.value as PersonaLook["faceStyle"] } }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                >
                  {FACE_STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium text-slate-600">
                Hair
                <select
                  value={draft.look.hairStyle}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, look: { ...d.look, hairStyle: e.target.value as PersonaLook["hairStyle"] } }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                >
                  {HAIR_STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium text-slate-600">
                Outfit
                <select
                  value={draft.look.outfitStyle}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, look: { ...d.look, outfitStyle: e.target.value as PersonaLook["outfitStyle"] } }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                >
                  {OUTFIT_STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium text-slate-600">
                Prop
                <select
                  value={draft.look.prop}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, look: { ...d.look, prop: e.target.value as PersonaLook["prop"] } }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                >
                  {PROPS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {COLOR_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span>{f.label}</span>
                  <input
                    type="color"
                    value={draft.look[f.key] as string}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, look: { ...d.look, [f.key]: e.target.value } }))
                    }
                    className="h-6 w-9 cursor-pointer rounded border border-slate-200 bg-transparent"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Voice & Pronunciation Glossary */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Volume2 className="h-3.5 w-3.5 text-brand-text" />
                    Gemini Voice
                  </Label>
                  <button
                    type="button"
                    disabled={testingVoice}
                    onClick={() => void handleTestVoice()}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-tint px-2.5 py-0.5 text-[10px] font-bold text-brand-hover transition hover:bg-[#ffe5d4] disabled:opacity-50"
                  >
                    {testingVoice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                    {testingVoice ? "Playing..." : "Test voice"}
                  </button>
                </div>
                <select
                  value={draft.voiceName}
                  onChange={(e) => setDraft((d) => ({ ...d, voiceName: e.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {GEMINI_VOICES.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Speaking Speed ({draft.speakingRate.toFixed(1)}x)
                </Label>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.1}
                  value={draft.speakingRate}
                  onChange={(e) => setDraft((d) => ({ ...d, speakingRate: Number(e.target.value) }))}
                  className="mt-2.5 w-full accent-brand"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Pronunciation Glossary (optional — TTS only, captions keep real spelling)
              </Label>
              <Textarea
                rows={2}
                value={draft.pronunciationGlossaryText}
                onChange={(e) => setDraft((d) => ({ ...d, pronunciationGlossaryText: e.target.value }))}
                placeholder={"ZRA = Z R A\nKwacha = Kwah-chah\nMwila = Mwee-lah"}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Personality Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Teaching Personality & Instructions *</Label>
            <Textarea
              rows={3}
              value={draft.personalityPrompt}
              onChange={(e) => setDraft((d) => ({ ...d, personalityPrompt: e.target.value }))}
              placeholder="Describe how this AI teacher greets students, corrects mistakes, and runs conversations..."
            />
          </div>

          {/* Active toggle & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                className="h-4 w-4 accent-brand"
              />
              Active (available in courses &amp; the Teacher&apos;s Room)
            </label>

            <div className="flex items-center gap-2">
              {draft.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleDelete(draft.id!)}
                  className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-xl bg-ink px-5 font-bold text-white hover:bg-ink-hover"
              >
                {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save AI Teacher
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
