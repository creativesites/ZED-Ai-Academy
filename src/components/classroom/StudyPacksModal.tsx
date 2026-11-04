"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Plus,
  Trash2,
  Loader2,
  X,
  Layers,
  GraduationCap,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getStudyPacks,
  generateClassStudyPack,
  deleteStudyPack,
  type StudyPack,
} from "@/actions/classroom-study-packs";

interface StudyPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companySlug: string;
  cohortId?: string | null;
  isAdminOrInstructor: boolean;
  materials?: Array<{ id: string; title: string }>;
}

export function StudyPacksModal({
  isOpen,
  onClose,
  companyId,
  companySlug,
  cohortId,
  isAdminOrInstructor,
  materials = [],
}: StudyPacksModalProps) {
  const [studyPacks, setStudyPacks] = useState<StudyPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePack, setActivePack] = useState<StudyPack | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "concepts" | "flashcards" | "quiz">("summary");

  // Generator State
  const [isGeneratingView, setIsGeneratingView] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isGenerating, startGenerating] = useTransition();

  // Flashcard state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  async function loadPacks() {
    setLoading(true);
    try {
      const data = await getStudyPacks(companyId, cohortId);
      setStudyPacks(data);
      if (data.length > 0 && !activePack) {
        setActivePack(data[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load study packs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadPacks();
    }
  }, [isOpen, companyId, cohortId]);

  function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();
    if (!topicInput.trim()) return;

    startGenerating(async () => {
      try {
        const pack = await generateClassStudyPack({
          companyId,
          companySlug,
          cohortId,
          topic: topicInput,
          documentIds: selectedDocIds,
        });
        toast.success("AI Study Pack generated successfully!");
        setStudyPacks((prev) => [pack, ...prev]);
        setActivePack(pack);
        setIsGeneratingView(false);
        setTopicInput("");
        setSelectedDocIds([]);
        setActiveSubTab("summary");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate study pack");
      }
    });
  }

  async function handleDelete(packId: string) {
    if (!confirm("Delete this study pack?")) return;
    try {
      await deleteStudyPack(packId, companyId, companySlug);
      toast.success("Study pack deleted");
      const updated = studyPacks.filter((p) => p.id !== packId);
      setStudyPacks(updated);
      setActivePack(updated[0] || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete pack");
    }
  }

  function handleSelectDoc(docId: string) {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[850px] p-0 rounded-2xl sm:rounded-3xl overflow-hidden border-none shadow-2xl max-h-[85dvh] flex flex-col bg-slate-50">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#062e39] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#fd5523]/20 text-[#fd5523] flex items-center justify-center border border-[#fd5523]/30 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#fd8d69]">
                  AI Classroom Intelligence
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-bold text-sky-200">
                  Revision &amp; Mastery
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">Class Study Packs</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminOrInstructor && !isGeneratingView && (
              <Button
                onClick={() => setIsGeneratingView(true)}
                size="sm"
                className="bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-black rounded-xl gap-1.5 shadow-md shadow-[#fd5523]/20 min-h-[38px]"
              >
                <Plus className="h-3.5 w-3.5" />
                New AI Pack
              </Button>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* View: Generator Form */}
          {isGeneratingView ? (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-black text-[#062e39]">
                    Generate AI Class Study Pack
                  </h4>
                  <p className="text-xs text-slate-400">
                    Instantly create summary guides, flashcards, and revision quizzes for your students
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsGeneratingView(false)}
                  className="text-xs font-bold text-slate-500"
                >
                  Cancel
                </Button>
              </div>

              <form onSubmit={handleCreatePack} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Topic or Learning Goal
                  </label>
                  <Input
                    required
                    placeholder="e.g. Prompt Engineering Frameworks & Few-Shot In-Context Learning"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    className="h-11 rounded-xl text-xs"
                  />
                </div>

                {materials.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Anchor to Class Documents (Optional)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                      {materials.map((m) => {
                        const isSelected = selectedDocIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectDoc(m.id)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-2",
                              isSelected
                                ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                                : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <span className="truncate flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              {m.title}
                            </span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isGenerating || !topicInput.trim()}
                  className="w-full bg-[#fd5523] hover:bg-[#e0481d] text-white font-black rounded-xl h-12 shadow-lg shadow-[#fd5523]/20 text-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Synthesizing Concepts &amp; Flashcards with Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Pack Now
                    </>
                  )}
                </Button>
              </form>
            </div>
          ) : loading ? (
            <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mb-3" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading Study Packs...</p>
            </div>
          ) : studyPacks.length === 0 ? (
            <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8">
              <div className="h-14 w-14 rounded-2xl bg-orange-50 text-[#fd5523] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-black text-[#062e39]">No Study Packs Published Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Study packs provide high-yield summaries, key concepts, flashcards, and revision quizzes.
              </p>
              {isAdminOrInstructor && (
                <Button
                  onClick={() => setIsGeneratingView(true)}
                  className="mt-4 bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-bold rounded-xl"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Generate First Study Pack
                </Button>
              )}
            </div>
          ) : (
            /* View: Study Pack Viewer */
            <div className="space-y-5">
              {/* Pack Selector Strip */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {studyPacks.map((pack) => {
                  const isCurrent = activePack?.id === pack.id;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => {
                        setActivePack(pack);
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                      }}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0",
                        isCurrent
                          ? "bg-[#062e39] text-white shadow-md"
                          : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Layers className="h-3.5 w-3.5 text-[#fd5523]" />
                      <span>{pack.title}</span>
                    </button>
                  );
                })}
              </div>

              {activePack && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                  {/* Pack Title & Meta */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Class Revision Resource
                      </span>
                      <h2 className="text-xl font-black text-[#062e39] mt-0.5">
                        {activePack.title}
                      </h2>
                    </div>

                    {isAdminOrInstructor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activePack.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>

                  {/* Navigation Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-100">
                    <button
                      onClick={() => setActiveSubTab("summary")}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold transition-all min-h-[38px]",
                        activeSubTab === "summary"
                          ? "bg-white text-[#fd5523] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setActiveSubTab("concepts")}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold transition-all min-h-[38px]",
                        activeSubTab === "concepts"
                          ? "bg-white text-[#fd5523] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Concepts ({activePack.concepts?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("flashcards")}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold transition-all min-h-[38px]",
                        activeSubTab === "flashcards"
                          ? "bg-white text-[#fd5523] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Flashcards ({activePack.flashcards?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("quiz")}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold transition-all min-h-[38px]",
                        activeSubTab === "quiz"
                          ? "bg-white text-[#fd5523] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Quiz ({activePack.quiz_questions?.length || 0})
                    </button>
                  </div>

                  {/* Content: Summary */}
                  {activeSubTab === "summary" && (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-xs md:text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                      {activePack.summary}
                    </div>
                  )}

                  {/* Content: Concepts */}
                  {activeSubTab === "concepts" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activePack.concepts || []).map((c, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                        >
                          <span className="text-xs font-black text-[#062e39] block">
                            {c.term}
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {c.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content: Interactive Flashcards */}
                  {activeSubTab === "flashcards" && (
                    <div className="space-y-4">
                      {activePack.flashcards && activePack.flashcards.length > 0 ? (
                        <div className="space-y-4">
                          <div
                            onClick={() => setIsFlipped((prev) => !prev)}
                            className="h-64 rounded-3xl p-8 border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white flex flex-col items-center justify-center text-center cursor-pointer select-none shadow-sm hover:border-[#fd5523]/40 transition-all relative"
                          >
                            <span className="absolute top-4 left-5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {isFlipped ? "Answer / Takeaway" : "Question / Concept Prompt"}
                            </span>
                            <span className="absolute top-4 right-5 text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <RotateCw className="h-3 w-3" /> Tap to Flip
                            </span>

                            <p className="text-base md:text-lg font-black text-[#062e39] max-w-lg leading-relaxed">
                              {isFlipped
                                ? activePack.flashcards[currentCardIndex]?.back
                                : activePack.flashcards[currentCardIndex]?.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentCardIndex === 0}
                              onClick={() => {
                                setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                                setIsFlipped(false);
                              }}
                              className="rounded-xl text-xs font-bold gap-1"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" /> Previous
                            </Button>

                            <span className="text-xs font-black text-slate-500">
                              Card {currentCardIndex + 1} of {activePack.flashcards.length}
                            </span>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentCardIndex === activePack.flashcards.length - 1}
                              onClick={() => {
                                setCurrentCardIndex((prev) =>
                                  Math.min(activePack.flashcards.length - 1, prev + 1)
                                );
                                setIsFlipped(false);
                              }}
                              className="rounded-xl text-xs font-bold gap-1"
                            >
                              Next <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-8">
                          No flashcards generated for this pack.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Content: Revision Quiz */}
                  {activeSubTab === "quiz" && (
                    <div className="space-y-4">
                      {(activePack.quiz_questions || []).map((q, qIndex) => {
                        const selected = selectedAnswers[qIndex];
                        const isAnswered = selected !== undefined;
                        const isCorrect = selected === q.correct_index;

                        return (
                          <div
                            key={qIndex}
                            className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3"
                          >
                            <p className="text-xs font-black text-[#062e39]">
                              {qIndex + 1}. {q.question}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, optIndex) => {
                                const isChosen = selected === optIndex;
                                const isTarget = q.correct_index === optIndex;

                                return (
                                  <button
                                    key={optIndex}
                                    type="button"
                                    onClick={() =>
                                      setSelectedAnswers((prev) => ({
                                        ...prev,
                                        [qIndex]: optIndex,
                                      }))
                                    }
                                    className={cn(
                                      "p-3 rounded-xl border text-left text-xs font-bold transition-all",
                                      isAnswered
                                        ? isTarget
                                          ? "bg-emerald-100/70 border-emerald-300 text-emerald-900"
                                          : isChosen
                                          ? "bg-red-100/70 border-red-300 text-red-900"
                                          : "bg-white border-slate-100 text-slate-400 opacity-60"
                                        : isChosen
                                        ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                                        : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300"
                                    )}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>

                            {isAnswered && (
                              <div
                                className={cn(
                                  "p-3 rounded-xl text-xs font-medium leading-relaxed border",
                                  isCorrect
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : "bg-amber-50 border-amber-200 text-amber-900"
                                )}
                              >
                                <span className="font-bold block mb-0.5">
                                  {isCorrect ? "✓ Correct!" : "⚠️ Explanation:"}
                                </span>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
