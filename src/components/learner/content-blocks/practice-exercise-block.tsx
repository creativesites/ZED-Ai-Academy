"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Info, Loader2, Wand2 } from "lucide-react";
import { submitPracticeExercise } from "@/actions/practice-exercises";

export function PracticeExerciseBlock({
  blockId,
  content,
  submission,
  onLaunchStudio,
}: {
  blockId: string;
  content: Record<string, unknown>;
  submission?: any;
  onLaunchStudio?: (initialTool?: string) => void;
}) {
  const title = (content.title as string) || "Practice Exercise";
  const brief = content.brief as string | undefined;
  const mode = (content.mode as string) || "text_response";
  const estimatedMinutes = content.estimated_minutes as number | undefined;
  const instructions = Array.isArray(content.instructions) 
    ? content.instructions.filter(Boolean) as string[] 
    : [];

  const score = submission?.practice_exercise_scores;
  const [isFormVisible, setIsFormVisible] = useState(!submission);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (score?.score >= 80) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [score]);

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return "🌟";
    if (score >= 80) return "💪";
    if (score >= 60) return "📚";
    return "🎯";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-green-500";
    if (score >= 60) return "from-yellow-400 to-orange-500";
    return "from-red-400 to-pink-500";
  };

  const getModeIcon = (mode: string) => {
    if (mode.includes("studio")) return "🔬";
    if (mode.includes("text")) return "✍️";
    if (mode.includes("code")) return "💻";
    return "📝";
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden">
      <div className="relative rounded-3xl sm:rounded-[2rem] bg-white border border-slate-200/60 transition-all duration-300 overflow-hidden">
        
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute text-lg"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  animation: `confetti ${1.5 + Math.random() * 2}s ease-out forwards`,
                  animationDelay: `${Math.random() * 0.5}s`,
                }}
              >
                {["🌟", "✨", "💚", "🎉", "👏"][i % 5]}
              </div>
            ))}
          </div>
        )}

        <div className="p-5 sm:p-6 md:p-8">
          <div className="flex gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 text-[11px] font-bold text-purple-700">
              <span className="text-sm">{getModeIcon(mode)}</span>
              {mode.replace(/_/g, " ")}
            </span>
            {estimatedMinutes && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 text-[11px] font-bold text-amber-700">
                ⏱️ {estimatedMinutes} min
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-200">
                <span className="text-lg sm:text-xl">🏋️</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">
                  Practice Exercise
                </p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#062e39] leading-tight">
                  {title}
                </h3>
              </div>
            </div>
          </div>

          {brief && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0 mt-0.5">💡</span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {brief}
                </p>
              </div>
            </div>
          )}

          {instructions.length > 0 && (
            <div className="mt-4">
              <button 
                onClick={() => toggleSection('instructions')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-left"
              >
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  📋 Instructions ({instructions.length} steps)
                </span>
                <span className={`text-sm transition-transform duration-200 ${expandedSections.instructions ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              <div className={`space-y-2 mt-2 transition-all duration-300 ${
                expandedSections.instructions !== false ? 'block' : 'hidden'
              }`}>
                {instructions.map((instruction, idx) => (
                  <div
                    key={`${instruction}-${idx}`}
                    className="flex gap-3 p-3 rounded-xl bg-white border border-slate-100 active:bg-emerald-50 transition-colors"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-600 leading-relaxed">
                      {instruction}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {submission && !isFormVisible ? (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 md:px-8 md:pb-8 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-emerald-700 truncate">
                  Attempt #{submission.attempt_number}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            {submission.text_response && (
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  "{submission.text_response}"
                </p>
              </div>
            )}

            {submission.practice_exercise_files?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {submission.practice_exercise_files.map((f: any) => (
                  <div
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    {f.file_name}
                  </div>
                ))}
              </div>
            )}

            {score ? (
              <div className="space-y-4">
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50 border border-emerald-100">
                  <div className={`
                    inline-flex h-16 w-16 items-center justify-center rounded-2xl
                    bg-gradient-to-br ${getScoreColor(score.score)}
                    shadow-lg mb-3
                  `}>
                    <span className="text-2xl font-black text-white">
                      {Math.round(score.score)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xl">{getScoreEmoji(score.score)}</span>
                    <p className="text-lg font-bold text-[#062e39] mt-1">
                      {score.score >= 90 ? "Outstanding!" : 
                       score.score >= 80 ? "Excellent!" : 
                       score.score >= 60 ? "Good Progress" : 
                       "Keep Learning!"}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getScoreColor(score.score)} rounded-full transition-all duration-1000`}
                      style={{ width: `${score.score}%` }}
                    />
                  </div>
                </div>

                {score.feedback_summary && (
                  <div className="p-4 rounded-xl bg-white border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-700 mb-1">🤖 Feedback</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {score.feedback_summary}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {score.strengths?.length > 0 && (
                    <div className="p-4 rounded-xl bg-white border border-green-100">
                      <p className="text-[11px] font-black uppercase tracking-widest text-green-600 mb-2">
                        💪 Strengths
                      </p>
                      <ul className="space-y-1.5">
                        {score.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {score.improvements?.length > 0 && (
                    <div className="p-4 rounded-xl bg-white border border-amber-100">
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-2">
                        🎯 To Improve
                      </p>
                      <ul className="space-y-1.5">
                        {score.improvements.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <Info className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-6 justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700">analyzing your work...</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full rounded-xl border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm py-5"
                onClick={() => setIsFormVisible(true)}
              >
                🔄 Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 md:px-8 md:pb-8 animate-fadeIn">
            <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 space-y-4">
              
              {["studio_workbench", "studio_submission", "combined"].includes(mode) && (
                <Button
                  type="button"
                  onClick={() => onLaunchStudio?.()}
                  className="w-full rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 py-4 text-sm font-bold"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Launch Practice Studio
                </Button>
              )}

              <form action={submitPracticeExercise} className="space-y-4">
                <input type="hidden" name="exercise_block_id" value={blockId} />
                <input type="hidden" name="studio_output" id={`studio-output-${blockId}`} />
                <input type="hidden" name="studio_tool_id" id={`studio-tool-${blockId}`} />
                <input type="hidden" name="studio_inputs" id={`studio-inputs-${blockId}`} />

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-emerald-700">
                    ✍️ Your Response
                  </label>
                  <textarea
                    name="text_response"
                    id={`text-response-${blockId}`}
                    rows={5}
                    placeholder="Write your answer here..."
                    className="w-full rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-emerald-700">
                    📎 Upload Evidence
                  </label>
                  <div className="relative rounded-xl border-2 border-dashed border-emerald-200 bg-white/50 p-4 text-center">
                    <p className="text-sm text-slate-500 mb-2">Drop files here or tap to browse</p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 text-[11px] font-bold text-emerald-700 border border-emerald-200 cursor-pointer active:bg-emerald-100 transition-colors">
                      <span>📁</span>
                      Choose Files
                      <input
                        name="files"
                        type="file"
                        multiple
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-2">Max 10MB each</p>
                  </div>
                </div>

                <Button className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 py-5 text-sm font-bold shadow-lg shadow-emerald-200/50 active:scale-[0.98] transition-transform">
                  🚀 Submit for Feedback
                </Button>
              </form>
            </div>
          </div>
        )}

        {submission && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 md:px-8 md:pb-8">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex gap-1">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      step <= submission.attempt_number
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-medium text-slate-400 shrink-0">
                {submission.attempt_number}/3 attempts
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
