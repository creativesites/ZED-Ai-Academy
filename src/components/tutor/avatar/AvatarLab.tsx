"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { TeacherStage } from "./TeacherStage";
import type { TeacherStageHandle } from "./TeacherStage";
import type { TeacherEngine } from "./Teacher";
import { PERSONA_PRESETS } from "./persona-presets";
import type { PersonaPresetKey } from "./persona-presets";
import { DEFAULT_PERSONA_LOOK } from "./types";
import type { AvatarDriver, AvatarEvent, PersonaLook } from "./types";
import { EventPlayer } from "@/components/tutor/EventPlayer";
import type { CardItem, PlayerUI } from "@/components/tutor/EventPlayer";
import {
  CONTRACT_VERSION,
  FACE_STYLES,
  GESTURES,
  HAIR_STYLES,
  MOODS,
  OUTFIT_STYLES,
  PROPS,
  TONE_SHAPES,
} from "@/lib/tutor/contract.generated";
import type { Gesture, Mood, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import { parseTutorTurn } from "@/lib/tutor/events";
import type { TutorEvent } from "@/lib/tutor/events";
import { SCENE_ARTBOARDS } from "@/lib/tutor/rive-driver";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";

// Staff-only lab for the teacher. Every gesture, mood, viseme, persona field, renderer option and the
// EventPlayer can be driven by hand here. It runs the Rive teacher by default, with the SVG placeholder
// one switch away, so both can be checked against the same contract.

const SAMPLE_TURN: unknown = {
  events: [
    { type: "gesture", name: "wave" },
    {
      type: "say",
      text: "你好！我是林老师。",
      romanization: "nǐ hǎo! wǒ shì lín lǎoshī.",
      translation: "Hello! I'm Teacher Lin.",
    },
    { type: "gesture", name: "point_card" },
    { type: "show_card", item: { text: "你好", pron: "nǐ hǎo", meaning: "hello", vocabId: "zh-nihao" } },
    { type: "trace_tone", tones: ["t2", "t3"], labels: ["ní", "hǎo"] },
    { type: "listen", expect: "nǐ hǎo", hint: "Two third tones: the first one rises." },
    { type: "gesture", name: "thumbs_up" },
    { type: "gesture", name: "celebrate" },
  ],
};

const SPEAK_SAMPLES = [
  { key: "zh", label: "Mandarin", text: "你好！我是林老师。" },
  { key: "es", label: "Spanish", text: "¡Hola! Soy Sofía." },
  { key: "fr", label: "French", text: "Bonjour ! Je suis Camille." },
] as const;

const COLOR_FIELDS: Array<{ key: keyof PersonaLook; label: string }> = [
  { key: "skinColor", label: "Skin" },
  { key: "skinShadeColor", label: "Skin shade" },
  { key: "hairColor", label: "Hair" },
  { key: "outfitPrimary", label: "Outfit" },
  { key: "outfitSecondary", label: "Blouse" },
  { key: "accentColor", label: "Accent" },
];

type LogKind = "avatar" | "tutor" | "error";
type LogEntry = { id: number; stamp: string; kind: LogKind; text: string };
type Caption = { text: string; roman?: string; en?: string };

function describeAvatar(e: AvatarEvent): string {
  const parts: string[] = [e.type];
  if (e.gesture) parts.push(e.gesture);
  if (e.toneShape) parts.push(e.toneShape);
  return parts.join(" · ");
}

function describeTutor(ev: TutorEvent): string {
  switch (ev.type) {
    case "say":
      return `say "${ev.text}"`;
    case "gesture":
      return `gesture ${ev.name}${ev.toneShape ? ` ${ev.toneShape}` : ""}${ev.countTo ? ` ${ev.countTo}` : ""}`;
    case "mood":
      return `mood ${ev.mood}${ev.intensity !== undefined ? ` ${ev.intensity}` : ""}`;
    case "show_card":
      return `show_card ${ev.item.text}`;
    case "show_text":
      return `show_text "${ev.text}"`;
    case "trace_tone":
      return `trace_tone [${ev.tones.join(", ")}]`;
    case "listen":
      return `listen${ev.expect ? ` expect "${ev.expect}"` : ""}`;
    case "note_mistake":
      return `note_mistake ${ev.category}: ${ev.said} → ${ev.correct}`;
    case "advance_scene":
      return `advance_scene ${ev.beat}`;
    case "end_session":
      return `end_session${ev.summary ? ` "${ev.summary}"` : ""}`;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#120c24]/70 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-300/90">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const FIELD = "rounded-lg border border-white/15 bg-[#0b0718] px-2 py-1.5 text-sm text-slate-100";
const BTN = "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-40";
const BTN_PRIMARY = "rounded-lg bg-[#fd5523] px-3 py-1.5 text-xs font-bold text-white shadow shadow-[#fd5523]/20 hover:bg-[#ea4817] disabled:opacity-40";

export function AvatarLab() {
  const avatarRef = useRef<TeacherStageHandle | null>(null);
  const playerRef = useRef<EventPlayer | null>(null);
  const seq = useRef(0);
  const t0 = useRef<number | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [whiteboard, setWhiteboard] = useState<string | null>(null);
  const [listenHint, setListenHint] = useState<{ expect?: string; hint?: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const [toneShape, setToneShape] = useState<ToneShape>("t1");
  const [countTo, setCountTo] = useState(3);
  const [mood, setMoodState] = useState<Mood>("warm");
  const [moodIntensity, setMoodIntensity] = useState(70);
  const [viseme, setVisemeState] = useState<VisemeValue>(0);
  const [speaking, setSpeakingState] = useState(false);
  const [listening, setListeningState] = useState(false);
  const [thinking, setThinkingState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lookX, setLookX] = useState(0);
  const [lookY, setLookY] = useState(0);
  const [persona, setPersona] = useState<PersonaLook>(DEFAULT_PERSONA_LOOK);
  const [presetKey, setPresetKey] = useState<PersonaPresetKey | null>(null);
  const [engine, setEngine] = useState<TeacherEngine>("rive");
  const [scene, setScene] = useState<SceneArtboard | "none">("Scene_TeaHouse");
  const [ambience, setAmbience] = useState(true);
  const [fps, setFps] = useState<number | null>(null);
  const [slowNote, setSlowNote] = useState(false);

  const log = useCallback((kind: LogKind, text: string) => {
    const now = performance.now();
    if (t0.current === null) t0.current = now;
    const stamp = `${((now - t0.current) / 1000).toFixed(2)}s`;
    seq.current += 1;
    const entry: LogEntry = { id: seq.current, stamp, kind, text };
    setLogs((prev) => [entry, ...prev].slice(0, 150));
  }, []);

  // Forwards to whichever avatar is mounted, so the player never holds a stale driver.
  const proxy = useMemo<AvatarDriver>(
    () => ({
      playGesture: (name, opts) => avatarRef.current?.playGesture(name, opts),
      setMood: (m, i) => avatarRef.current?.setMood(m, i),
      setViseme: (v) => avatarRef.current?.setViseme(v),
      setSpeaking: (on) => avatarRef.current?.setSpeaking(on),
      setListening: (on, level) => avatarRef.current?.setListening(on, level),
      setThinking: (on) => avatarRef.current?.setThinking(on),
      lookAt: (x, y) => avatarRef.current?.lookAt(x, y),
    }),
    [],
  );

  const ui = useMemo<PlayerUI>(
    () => ({
      onCaption: (text, roman, en) => setCaption({ text, roman, en }),
      onCard: (item) => setCard(item),
      onText: (text) => setWhiteboard(text),
      onListen: (expect, hint) => setListenHint({ expect, hint }),
      onMistake: (m) => log("tutor", `note_mistake ${m.category}: ${m.said} → ${m.correct}`),
      onEnd: (summary) => log("tutor", `end_session${summary ? `: ${summary}` : ""}`),
      onAdvance: (beat) => log("tutor", `advance_scene ${beat}`),
    }),
    [log],
  );

  const ensurePlayer = useCallback((): EventPlayer => {
    if (!playerRef.current) {
      playerRef.current = new EventPlayer({
        avatar: proxy,
        ui,
        onEventStart: (ev) => log("tutor", `▶ ${describeTutor(ev)}`),
      });
    }
    return playerRef.current;
  }, [proxy, ui, log]);

  const handleAvatarEvent = useCallback(
    (e: AvatarEvent) => {
      log("avatar", describeAvatar(e));
      playerRef.current?.notify(e);
    },
    [log],
  );

  // Cancel any running turn when the lab unmounts, so no timers outlive the page.
  useEffect(() => {
    return () => playerRef.current?.stop();
  }, []);

  const playSample = () => {
    const parsed = parseTutorTurn(SAMPLE_TURN);
    if (!parsed.ok) {
      setSampleError(parsed.error);
      log("error", `sample turn rejected: ${parsed.error}`);
      return;
    }
    setSampleError(null);
    if (parsed.dropped > 0) log("error", `${parsed.dropped} sample event(s) dropped by parseTutorTurn`);
    setPlaying(true);
    ensurePlayer()
      .play(parsed.events)
      .finally(() => setPlaying(false));
  };

  const speakSample = (text: string) => {
    const ev: TutorEvent = { type: "say", text };
    void ensurePlayer().play([ev]);
  };

  const stopAll = () => {
    playerRef.current?.stop();
    setPlaying(false);
    setCard(null);
    setListenHint(null);
    setCaption(null);
    setWhiteboard(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 border-b border-slate-800/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Staff only</p>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Avatar Lab</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Drive the teacher directly. The Rive teacher and the SVG placeholder both implement AvatarDriver, so anything
            that works on one should work on the other. Switch the engine in Renderer.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-300">
          Contract v{CONTRACT_VERSION}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Stage */}
        <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#160f36] via-[#2a1745] to-[#40204d] shadow-2xl shadow-black/40">
          <TeacherStage
            ref={avatarRef}
            engine={engine}
            scene={engine === "rive" && scene !== "none" ? scene : null}
            ambience={ambience}
            persona={persona}
            reducedMotion={reducedMotion}
            onEvent={handleAvatarEvent}
            onFps={setFps}
            onLowPerformance={() => setSlowNote(true)}
            wrapClassName="absolute inset-y-0 right-0 flex w-[72%] items-center justify-center pt-10"
            teacherClassName="h-[440px] w-full max-w-[360px]"
            label="Animated AI teacher (Avatar Lab)"
          />
          <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#ffb867]/15 blur-3xl" />
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
              {engine === "rive" ? "Rive" : "Placeholder"}
            </span>
            {engine === "rive" && fps !== null && (
              <span className="rounded-full bg-black/30 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-200">
                {Math.round(fps)} fps
              </span>
            )}
            {playing && (
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                Playing turn
              </span>
            )}
          </div>

          {whiteboard && (
            <div className="absolute right-4 top-4 max-w-[45%] rounded-xl bg-[#fbf3e6]/90 px-3 py-2 text-sm font-semibold text-[#2a1745] shadow-lg">
              {whiteboard}
            </div>
          )}

          {card && (
            <div className="absolute left-4 top-1/3 w-[34%] min-w-[120px] rounded-2xl border border-white/20 bg-[#fbf3e6] p-3 text-[#2a1745] shadow-xl">
              <div className="font-serif text-2xl font-bold leading-tight">{card.text}</div>
              {card.pron && <div className="mt-1 font-mono text-xs text-[#6b4d7a]">{card.pron}</div>}
              {card.meaning && <div className="mt-1 text-sm">{card.meaning}</div>}
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8a5a2b]">+ added to deck</div>
            </div>
          )}

          {listenHint && (
            <div className="absolute bottom-28 left-4 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-100">
              <span className="font-bold">Your turn</span>
              {listenHint.expect && <span> · expect “{listenHint.expect}”</span>}
              {listenHint.hint && <div className="mt-0.5 text-emerald-200/80">{listenHint.hint}</div>}
            </div>
          )}

          {caption && (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/40 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-lg font-semibold text-white">{caption.text}</div>
              {caption.roman && <div className="mt-0.5 font-mono text-xs text-amber-200/90">{caption.roman}</div>}
              {caption.en && <div className="mt-0.5 text-sm text-slate-200/80">{caption.en}</div>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Renderer">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                engine
                <select
                  className={FIELD}
                  value={engine}
                  onChange={(e) => {
                    setEngine(e.target.value as TeacherEngine);
                    setFps(null);
                  }}
                >
                  <option value="rive">rive</option>
                  <option value="placeholder">placeholder</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                scene
                <select
                  className={FIELD}
                  value={scene}
                  disabled={engine !== "rive"}
                  onChange={(e) => setScene(e.target.value as SceneArtboard | "none")}
                >
                  <option value="none">none</option>
                  {SCENE_ARTBOARDS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <Toggle label="ambience" checked={ambience} onChange={setAmbience} />
              <button
                type="button"
                className={BTN}
                disabled={engine !== "rive"}
                onClick={() => avatarRef.current?.celebrate()}
              >
                celebrate scene
              </button>
              <span className="font-mono text-slate-300">fps {fps === null ? "--" : Math.round(fps)}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              fps is the page animation loop, read every 2 s after a 1 s settle and a 3 s warm-up.
              {slowNote && engine === "rive" ? " Under 45 fps for two windows: ambience is now off for this session." : ""}
            </p>
          </Section>

          <Section title="Gestures">
            <div className="grid grid-cols-3 gap-1.5">
              {GESTURES.map((g: Gesture) => (
                <button
                  key={g}
                  type="button"
                  className={BTN}
                  onClick={() => avatarRef.current?.playGesture(g, { toneShape, countTo })}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                toneShape
                <select className={FIELD} value={toneShape} onChange={(e) => setToneShape(e.target.value as ToneShape)}>
                  {TONE_SHAPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                countTo
                <input
                  type="number"
                  min={1}
                  max={5}
                  className={`${FIELD} w-16`}
                  value={countTo}
                  onChange={(e) => setCountTo(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
            </div>
          </Section>

          <Section title="Mood and mouth">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <select
                className={FIELD}
                value={mood}
                onChange={(e) => {
                  const m = e.target.value as Mood;
                  setMoodState(m);
                  avatarRef.current?.setMood(m, moodIntensity);
                }}
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <label className="flex flex-1 items-center gap-2">
                intensity {moodIntensity}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={moodIntensity}
                  className="flex-1 accent-amber-400"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMoodIntensity(v);
                    avatarRef.current?.setMood(mood, v);
                  }}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 text-xs text-slate-300">
              viseme {viseme}
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={viseme}
                className="flex-1 accent-amber-400"
                onChange={(e) => {
                  const v = Number(e.target.value) as VisemeValue;
                  setVisemeState(v);
                  avatarRef.current?.setViseme(v);
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {SPEAK_SAMPLES.map((s) => (
                <button key={s.key} type="button" className={BTN} onClick={() => speakSample(s.text)}>
                  Speak {s.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="State">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <Toggle
                label="speaking"
                checked={speaking}
                onChange={(on) => {
                  setSpeakingState(on);
                  avatarRef.current?.setSpeaking(on);
                }}
              />
              <Toggle
                label="listening"
                checked={listening}
                onChange={(on) => {
                  setListeningState(on);
                  avatarRef.current?.setListening(on, 40);
                }}
              />
              <Toggle
                label="thinking"
                checked={thinking}
                onChange={(on) => {
                  setThinkingState(on);
                  avatarRef.current?.setThinking(on);
                }}
              />
              <Toggle label="reducedMotion" checked={reducedMotion} onChange={setReducedMotion} />
            </div>
            <label className="flex items-center gap-3 text-xs text-slate-300">
              lookX {lookX}
              <input
                type="range"
                min={-100}
                max={100}
                value={lookX}
                className="flex-1 accent-amber-400"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLookX(v);
                  avatarRef.current?.lookAt(v, lookY);
                }}
              />
            </label>
            <label className="flex items-center gap-3 text-xs text-slate-300">
              lookY {lookY}
              <input
                type="range"
                min={-100}
                max={100}
                value={lookY}
                className="flex-1 accent-amber-400"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLookY(v);
                  avatarRef.current?.lookAt(lookX, v);
                }}
              />
            </label>
          </Section>

          <Section title="Persona">
            <div className="flex flex-wrap gap-2">
              {PERSONA_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={presetKey === preset.key}
                  className={`${BTN} ${presetKey === preset.key ? "border-amber-300/70 bg-amber-300/15" : ""}`}
                  onClick={() => {
                    setPersona(preset.look);
                    setPresetKey(preset.key);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2">
                  {f.label}
                  <input
                    type="color"
                    className="h-7 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
                    value={persona[f.key] as string}
                    onChange={(e) => {
                      setPresetKey(null);
                      setPersona((p) => ({ ...p, [f.key]: e.target.value }));
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <select
                className={FIELD}
                value={persona.faceStyle}
                aria-label="faceStyle"
                onChange={(e) => {
                  setPresetKey(null);
                  setPersona((p) => ({ ...p, faceStyle: e.target.value as PersonaLook["faceStyle"] }));
                }}
              >
                {FACE_STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                className={FIELD}
                value={persona.hairStyle}
                onChange={(e) => setPersona((p) => ({ ...p, hairStyle: e.target.value as PersonaLook["hairStyle"] }))}
              >
                {HAIR_STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                className={FIELD}
                value={persona.outfitStyle}
                onChange={(e) =>
                  setPersona((p) => ({ ...p, outfitStyle: e.target.value as PersonaLook["outfitStyle"] }))
                }
              >
                {OUTFIT_STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                className={FIELD}
                value={persona.prop}
                onChange={(e) => setPersona((p) => ({ ...p, prop: e.target.value as PersonaLook["prop"] }))}
              >
                {PROPS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  setPersona(DEFAULT_PERSONA_LOOK);
                  setPresetKey(null);
                }}
              >
                Reset look
              </button>
            </div>
          </Section>

          <Section title="Turns">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_PRIMARY} onClick={playSample} disabled={playing}>
                Play sample turn
              </button>
              <button type="button" className={BTN} onClick={stopAll}>
                Stop
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Mandarin greeting scene: wave, say, point_card, show_card, trace_tone [t2, t3], listen, thumbs_up,
              celebrate. The listen step does not wait for a learner; the next events play straight after it.
            </p>
            {sampleError && <p className="text-xs text-red-300">Sample rejected: {sampleError}</p>}
          </Section>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0b0718]/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-300/90">Event log</h2>
          <button type="button" className={BTN} onClick={() => setLogs([])}>
            Clear
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing yet. Press a gesture or play a turn.</p>
        ) : (
          <ol className="max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
            {logs.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="w-14 shrink-0 text-right text-slate-500">{entry.stamp}</span>
                <span
                  className={
                    entry.kind === "avatar"
                      ? "w-14 shrink-0 text-sky-300"
                      : entry.kind === "tutor"
                        ? "w-14 shrink-0 text-amber-300"
                        : "w-14 shrink-0 text-red-300"
                  }
                >
                  {entry.kind}
                </span>
                <span className="text-slate-200">{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-400" />
      {label}
    </label>
  );
}
