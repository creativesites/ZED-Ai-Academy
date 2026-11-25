"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Flame,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { personaPreset } from "@/components/tutor/avatar/persona-presets";
import type { AvatarDriver } from "@/components/tutor/avatar/types";
import { DEFAULT_DECK_TEACHER, deckTeacherFor } from "@/lib/tutor/deck-teacher";
import { compareResponseToTarget, type ResponseMatchResult } from "@/lib/tutor/response-match";
import {
  formatInterval,
  isCardDue,
  reviewCard,
  summarizeDeck,
  type ReviewQuality,
} from "@/lib/tutor/srs";
import { speechLangFor } from "@/lib/tutor/speech-lang";
import {
  addManualVocabCard,
  deleteLearnerVocabCard,
  submitVocabReview,
} from "@/actions/tutor-learner";
import type { LearnerDeckCard } from "@/lib/tutor/server/learner-overview";
import { playChoiceChime, playStepTick } from "./sound-fx";
import { useLiteMode } from "./use-lite-mode";
import { useTeacherVoice } from "@/components/tutor/voice/use-teacher-voice";
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

const LANG_LABELS: Record<string, string> = {
  en: "General / English",
  zh: "Mandarin",
  es: "Spanish",
  fr: "French",
  bem: "Bemba",
  ny: "Nyanja",
  tog: "Tonga",
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export function VocabDeckReview({
  initialCards,
  backHref,
  backLabel = "Back to Teacher",
  companyId,
}: {
  initialCards: LearnerDeckCard[];
  backHref: string;
  backLabel?: string;
  companyId?: string;
}) {
  const avatarRef = useRef<AvatarDriver | null>(null);
  // Data saver: the light SVG teacher instead of the Rive one. The card is still read aloud.
  const [lite] = useLiteMode();
  // TeacherVoice: each card is read by its language's teacher with that persona's server voice (no
  // browser speech). Without server audio the card is simply not read aloud.
  const { speak: speakWithTeacher } = useTeacherVoice({ voice: DEFAULT_DECK_TEACHER.voice });
  const speakTerm = useCallback(
    (text: string, language: string, rate: number) => {
      void speakWithTeacher(text, {
        voice: deckTeacherFor(language).voice,
        language,
        rate,
        avatar: avatarRef.current,
      });
    },
    [speakWithTeacher],
  );
  const [cards, setCards] = useState<LearnerDeckCard[]>(initialCards);
  const [langFilter, setLangFilter] = useState<string>("all");
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [coachLine, setCoachLine] = useState("Recall the answer out loud or type it, then reveal to check and rate yourself.");
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [recallDraft, setRecallDraft] = useState("");
  const [recallMatch, setRecallMatch] = useState<ResponseMatchResult | null>(null);
  const [listeningVoice, setListeningVoice] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  // Add-card form state
  const [newLang, setNewLang] = useState("en");
  const [newTerm, setNewTerm] = useState("");
  const [newPron, setNewPron] = useState("");
  const [newMeaning, setNewMeaning] = useState("");

  const languages = useMemo(() => {
    const set = new Set(cards.map((c) => c.language));
    return [...set].sort();
  }, [cards]);

  const filteredCards = useMemo(
    () => (langFilter === "all" ? cards : cards.filter((c) => c.language === langFilter)),
    [cards, langFilter],
  );

  const dueQueue = useMemo(
    () =>
      filteredCards
        .filter((c) => isCardDue(c.dueAt))
        .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)),
    [filteredCards],
  );

  const summary = useMemo(() => summarizeDeck(filteredCards), [filteredCards]);
  const activeCard = dueQueue[0] ?? null;

  // Persona by key (never by array index): the card's language picks the teacher.
  const activePreset = personaPreset(
    activeCard
      ? deckTeacherFor(activeCard.language).presetKey
      : langFilter !== "all"
        ? deckTeacherFor(langFilter).presetKey
        : DEFAULT_DECK_TEACHER.presetKey,
  );

  const handleRate = useCallback(
    (quality: ReviewQuality) => {
      if (!activeCard || isPending) return;

      if (quality === "easy") {
        avatarRef.current?.setMood("proud", 90);
        avatarRef.current?.playGesture("celebrate");
        setCoachLine("Effortless! I'll bring that back much later.");
      } else if (quality === "good") {
        avatarRef.current?.setMood("happy", 85);
        avatarRef.current?.playGesture("thumbs_up");
        setCoachLine("Nice recall! Keep your rhythm going.");
      } else if (quality === "hard") {
        avatarRef.current?.setMood("warm", 75);
        avatarRef.current?.playGesture("nod");
        setCoachLine("Good effort — we'll review this one again soon.");
      } else {
        avatarRef.current?.setMood("concerned", 70);
        avatarRef.current?.playGesture("oops");
        setCoachLine("No worries! Say it once more out loud — it will come back in 10 minutes.");
      }

      const cardId = activeCard.vocabId;
      setRevealed(false);
      setRecallDraft("");
      setRecallMatch(null);
      playStepTick({ muted: false, volume: 0.7 });

      startTransition(async () => {
        try {
          const next = await submitVocabReview(cardId, quality);
          setCards((prev) =>
            prev.map((c) =>
              c.vocabId === cardId
                ? {
                    ...c,
                    dueAt: next.dueAt,
                    intervalDays: next.intervalDays,
                    ease: next.ease,
                    reps: next.reps,
                    lapses: next.lapses,
                  }
                : c,
            ),
          );
          setReviewedCount((n) => n + 1);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save review");
        }
      });
    },
    [activeCard, isPending],
  );

  // Keyboard shortcuts: Space reveals, 1-4 rates
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (addOpen || !activeCard) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        if (e.key === "1") handleRate("again");
        else if (e.key === "2") handleRate("hard");
        else if (e.key === "3") handleRate("good");
        else if (e.key === "4") handleRate("easy");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard, addOpen, revealed, handleRate]);

  const checkRecallAttempt = useCallback(
    (attempt: string) => {
      if (!activeCard || !attempt.trim()) return;
      // Compare against meaning (concepts/definitions) or term (spoken phrases) — pick whichever fits better!
      const vsMeaning = activeCard.meaning
        ? compareResponseToTarget(attempt, activeCard.meaning)
        : null;
      const vsTerm = compareResponseToTarget(attempt, activeCard.term);
      const best = vsMeaning && vsMeaning.score >= vsTerm.score ? vsMeaning : vsTerm;
      setRecallMatch(best);
      setRevealed(true);
      playChoiceChime({ muted: false, volume: 0.7 });
      if (best.score >= 85) {
        avatarRef.current?.setMood("proud", 85);
        avatarRef.current?.playGesture("thumbs_up");
        setCoachLine(`Spot on (${best.score}% match)! Rate how easy that felt.`);
      } else if (best.score >= 55) {
        avatarRef.current?.setMood("warm", 75);
        avatarRef.current?.playGesture("nod");
        setCoachLine(`Close (${best.score}% match)! Check the highlighted words below.`);
      } else {
        avatarRef.current?.setMood("concerned", 65);
        setCoachLine("Take a look at the answer, listen once, and try it again soon.");
      }
    },
    [activeCard],
  );

  const toggleVoiceRecall = () => {
    if (!activeCard) return;
    if (listeningVoice) {
      recognitionRef.current?.stop();
      setListeningVoice(false);
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) {
      toast.error("Voice recall isn't supported in this browser — type your answer below instead.");
      return;
    }
    recognitionRef.current = rec;
    rec.lang = speechLangFor(activeCard.term, activeCard.language);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const spoken = e.results[0]?.[0]?.transcript ?? "";
      setListeningVoice(false);
      if (spoken.trim()) {
        setRecallDraft(spoken);
        checkRecallAttempt(spoken);
      }
    };
    rec.onerror = () => {
      setListeningVoice(false);
      toast.error("Could not hear speech — try again or type your answer.");
    };
    rec.onend = () => {
      setListeningVoice(false);
    };
    setListeningVoice(true);
    avatarRef.current?.setListening(true, 0.5);
    rec.start();
  };

  function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTerm.trim() || !newMeaning.trim()) {
      toast.error("Enter both the word/phrase and its meaning.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await addManualVocabCard({
          companyId,
          language: newLang,
          term: newTerm.trim(),
          pron: newPron.trim() || null,
          meaning: newMeaning.trim(),
        });
        setCards((prev) => [created, ...prev]);
        setNewTerm("");
        setNewPron("");
        setNewMeaning("");
        setAddOpen(false);
        toast.success(`Added "${created.term}" to your deck`);
        avatarRef.current?.playGesture("wave");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add card");
      }
    });
  }

  function handleDelete(vocabId: string) {
    startTransition(async () => {
      try {
        await deleteLearnerVocabCard(vocabId);
        setCards((prev) => prev.filter((c) => c.vocabId !== vocabId));
        toast.success("Card removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove card");
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        {/* Top Navigation & Stats */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
            <h1 className="mt-1.5 font-heading text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Study Deck &amp; Active Recall
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Review saved concepts, key takeaways, formulas, and phrases with spaced repetition.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-10 rounded-xl bg-brand px-4 text-xs font-bold text-white hover:bg-brand-hover"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Study Card
          </Button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Due Now", value: summary.dueNow, accent: "text-brand-text" },
            { label: "Reviewed Today", value: reviewedCount, accent: "text-blue-600" },
            { label: "Mastered", value: summary.mastered, accent: "text-emerald-600" },
            { label: "Total Cards", value: summary.total, accent: "text-ink" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={`text-2xl font-black ${s.accent}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Language Filter Pills */}
        {languages.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLangFilter("all");
                setRevealed(false);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                langFilter === "all"
                  ? "bg-ink text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              All languages ({cards.length})
            </button>
            {languages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setLangFilter(lang);
                  setRevealed(false);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  langFilter === lang
                    ? "bg-brand text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {LANG_LABELS[lang] ?? lang.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Active Review Stage with Animated Teacher Coach */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          {/* Teacher Coach Bar */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-ink via-[#132842] to-[#2a1745] px-5 py-4 text-white">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/25">
              <Teacher
                ref={avatarRef}
                variant="bust"
                engine={lite ? "placeholder" : undefined}
                persona={activePreset.look}
                className="h-16 w-16"
                label={`${activePreset.label}, your vocabulary coach`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                {activePreset.label} · Spoken Recall Coach
              </p>
              <p className="mt-0.5 text-sm text-white/90">{coachLine}</p>
            </div>
          </div>

          {/* Flashcard Body */}
          <div className="p-6 sm:p-10">
            {!activeCard ? (
              <div className="py-6 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-black text-ink">
                  {summary.total === 0 ? "Your study deck is empty" : "All caught up for now!"}
                </h2>
                <p className="mx-auto max-w-md text-sm text-slate-500">
                  {summary.total === 0
                    ? "Bookmark key concepts, board takeaways, or phrases during any teaching session and they appear here for spaced-repetition review."
                    : "Great work! Come back later when your next cards are due, or start a teaching session."}
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="rounded-xl bg-brand font-bold text-white hover:bg-brand-hover"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Study Card
                  </Button>
                  <Link
                    href={backHref}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-ink hover:bg-slate-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-brand-text" />
                    Open Teacher
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase text-slate-600">
                    {LANG_LABELS[activeCard.language] ?? activeCard.language}
                  </span>
                  {activeCard.level && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                      {activeCard.level}
                    </span>
                  )}
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                    {dueQueue.length} due
                  </span>
                </div>

                {/* Front: Term + Audio */}
                <div className="space-y-3 py-2">
                  <h2
                    className={`font-bold tracking-tight text-ink ${
                      activeCard.term.length > 32
                        ? "mx-auto max-w-xl font-heading text-xl leading-snug sm:text-2xl"
                        : "font-serif text-3xl sm:text-5xl"
                    }`}
                  >
                    {activeCard.term}
                  </h2>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        speakTerm(activeCard.term, activeCard.language, 1.0)
                      }
                      className="rounded-full border-slate-200 text-xs font-bold"
                    >
                      <Volume2 className="mr-1.5 h-3.5 w-3.5 text-brand-text" />
                      Listen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        speakTerm(activeCard.term, activeCard.language, 0.7)
                      }
                      className="rounded-full border-slate-200 text-xs font-semibold text-slate-600"
                    >
                      Slow (0.7x)
                    </Button>
                  </div>
                </div>

                {/* Back: Active Recall (Voice or Type) + Answer + SM-2 Buttons */}
                {!revealed ? (
                  <div className="mx-auto max-w-md space-y-3 pt-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        checkRecallAttempt(recallDraft);
                      }}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={toggleVoiceRecall}
                        title={listeningVoice ? "Stop listening" : "Speak your recall out loud"}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                          listeningVoice
                            ? "animate-pulse border-brand bg-brand text-white"
                            : "border-slate-200 bg-white text-ink hover:border-brand/50 hover:bg-brand-tint"
                        }`}
                        aria-label={listeningVoice ? "Stop voice recall" : "Speak your recall"}
                      >
                        {listeningVoice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                      <Input
                        value={recallDraft}
                        onChange={(e) => setRecallDraft(e.target.value)}
                        placeholder={listeningVoice ? "Listening… speak now" : "Type or speak your answer…"}
                        className="h-11 rounded-xl"
                      />
                      <Button
                        type="submit"
                        disabled={!recallDraft.trim()}
                        className="h-11 shrink-0 rounded-xl bg-brand px-4 text-xs font-bold text-white hover:bg-brand-hover"
                      >
                        Check
                      </Button>
                    </form>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRevealed(true)}
                      className="h-10 rounded-xl border-slate-200 px-6 text-xs font-bold text-ink"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Reveal Answer (Space)
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5 border-t border-slate-100 pt-5">
                    {recallMatch && (
                      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-500">Your recall check</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                              recallMatch.score >= 75
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {recallMatch.score}% match · Suggested: {recallMatch.suggestedQuality}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {recallMatch.tokens.map((tok, i) => (
                            <span
                              key={`${tok.text}-${i}`}
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                tok.matched
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {tok.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      {activeCard.pron && (
                        <p className="font-mono text-base font-semibold text-brand-text">
                          {activeCard.pron}
                        </p>
                      )}
                      <p className="text-lg font-bold text-slate-800 sm:text-xl">
                        {activeCard.meaning || "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {(
                        [
                          { q: "again", label: "Again", keyHint: "1", cls: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" },
                          { q: "hard", label: "Hard", keyHint: "2", cls: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" },
                          { q: "good", label: "Good", keyHint: "3", cls: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
                          { q: "easy", label: "Easy", keyHint: "4", cls: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" },
                        ] as const
                      ).map((opt) => {
                        const preview = reviewCard(activeCard, opt.q);
                        const isSuggested = recallMatch?.suggestedQuality === opt.q;
                        return (
                          <button
                            key={opt.q}
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRate(opt.q)}
                            className={`flex flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition-all ${opt.cls} ${
                              isSuggested ? "ring-2 ring-brand ring-offset-2" : ""
                            }`}
                          >
                            <span className="text-sm font-black">
                              {opt.label}
                              {isSuggested ? " ★" : ""}
                            </span>
                            <span className="mt-0.5 text-[11px] font-semibold opacity-75">
                              {preview.nextLabel} · [{opt.keyHint}]
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* All Cards List */}
        {filteredCards.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">
              All Cards in Deck ({filteredCards.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredCards.map((c) => {
                const due = isCardDue(c.dueAt);
                const mastered = c.intervalDays >= 14 && c.reps >= 2;
                return (
                  <div
                    key={c.vocabId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg font-bold text-ink">{c.term}</span>
                        {c.pron && <span className="font-mono text-xs text-brand-text">{c.pron}</span>}
                      </div>
                      <p className="truncate text-xs text-slate-600">{c.meaning || "—"}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-slate-400">{LANG_LABELS[c.language] ?? c.language}</span>
                        <span
                          className={
                            mastered
                              ? "text-emerald-600"
                              : due
                                ? "text-brand-text"
                                : "text-blue-600"
                          }
                        >
                          {mastered
                            ? "Mastered"
                            : due
                              ? "Due now"
                              : `In ${formatInterval(c.intervalDays)}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => speakTerm(c.term, c.language, 1.0)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-text"
                        aria-label={`Listen to ${c.term}`}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(c.vocabId)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        aria-label={`Remove ${c.term}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Add Card Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-ink">
              <Flame className="h-5 w-5 text-brand-text" />
              Add Study Card
            </DialogTitle>
            <DialogDescription>
              Save a key concept, formula, definition, or phrase to review with spaced repetition and active recall.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCard} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Subject / Language</Label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="en">General / English</option>
                <option value="zh">Mandarin Chinese (zh)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="bem">Bemba (bem)</option>
                <option value="ny">Nyanja (ny)</option>
                <option value="tog">Tonga (tog)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Concept, Question, or Phrase *</Label>
              <Input
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="e.g. Gross Margin Formula, Big-O O(log n), or 谢谢"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Hint / Pronunciation (optional)</Label>
              <Input
                value={newPron}
                onChange={(e) => setNewPron(e.target.value)}
                placeholder="e.g. Finance metric, Binary search, or xièxie"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Answer / Key Takeaway *</Label>
              <Input
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
                placeholder="e.g. (Revenue - COGS) / Revenue × 100"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-ink font-bold text-white hover:bg-ink-hover"
              >
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                Save to Deck
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
