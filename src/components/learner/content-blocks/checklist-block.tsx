"use client";

import { useState, useEffect } from "react";

export function ChecklistBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const items = (content.items as string[]) ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [animateItem, setAnimateItem] = useState<number | null>(null);
  
  if (!items.length) return null;

  const progress = items.length > 0 ? (checked.size / items.length) * 100 : 0;
  const isComplete = checked.size === items.length;

  function toggle(i: number) {
    setAnimateItem(i);
    setTimeout(() => setAnimateItem(null), 500);
    
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
        return next;
      } else {
        next.add(i);
        
        // Check if this was the last item
        if (next.size === items.length) {
          setJustCompleted(true);
          setShowConfetti(true);
          setTimeout(() => {
            setShowConfetti(false);
            setJustCompleted(false);
          }, 3000);
        }
        
        return next;
      }
    });
  }

  const getProgressEmoji = () => {
    if (isComplete) return "🎉";
    if (progress >= 75) return "💪";
    if (progress >= 50) return "📚";
    if (progress >= 25) return "🚀";
    return "📝";
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden">
      {/* Confetti celebration on completion */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-lg"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                animation: `checklistConfetti ${1.5 + Math.random() * 2}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            >
              {["🌟", "✨", "✅", "🎉", "👏", "💚", "🏆", "🔥"][i % 8]}
            </div>
          ))}
        </div>
      )}

      {/* Main card */}
      <div className={`
        relative rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 md:p-8
        transition-all duration-500
        ${isComplete 
          ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border-2 border-emerald-200 shadow-lg shadow-emerald-100' 
          : 'bg-white border border-slate-200 shadow-md shadow-slate-100'
        }
      `}>
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            {title && (
              <div className="flex items-center gap-2 mb-2">
                <div className={`
                  flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl
                  transition-all duration-500
                  ${isComplete 
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200' 
                    : 'bg-slate-100'
                  }
                `}>
                  <span className="text-lg sm:text-xl">
                    {isComplete ? "✅" : "📋"}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[#062e39]">
                    {title}
                  </h3>
                  {isComplete && (
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 animate-fadeIn">
                      ✨ All Complete!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Progress badge */}
          <div className="shrink-0 ml-4">
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider
              transition-all duration-300
              ${isComplete 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                : 'bg-slate-50 text-slate-500 border border-slate-200'
              }
            `}>
              <span>{getProgressEmoji()}</span>
              <span>{checked.size}/{items.length}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
            <span>Progress</span>
            <span className="transition-all duration-300">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-700 ease-out
                ${isComplete 
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500' 
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                }
              `}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-2 sm:space-y-3">
          {items.map((item, i) => {
            const isChecked = checked.has(i);
            
            return (
              <label
                key={i}
                className={`
                  group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl
                  transition-all duration-300 cursor-pointer select-none
                  active:scale-[0.98] sm:hover:bg-slate-50
                  ${isChecked 
                    ? 'bg-emerald-50/50 border border-emerald-100' 
                    : 'border border-transparent sm:hover:border-slate-200 sm:hover:shadow-sm'
                  }
                  ${animateItem === i ? 'animate-itemCheck' : ''}
                `}
                onClick={() => toggle(i)}
              >
                {/* Custom checkbox */}
                <div
                  className={`
                    relative mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center 
                    rounded-lg border-2 transition-all duration-300
                    ${isChecked
                      ? 'border-emerald-500 bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-200'
                      : 'border-slate-300 bg-white group-hover:border-emerald-400 group-hover:shadow-sm'
                    }
                  `}
                >
                  {isChecked && (
                    <svg 
                      className="h-4 w-4 text-white animate-checkMark" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={3} 
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {!isChecked && (
                    <div className="h-3 w-3 rounded-sm opacity-0 group-hover:opacity-30 bg-emerald-400 transition-opacity" />
                  )}
                </div>

                {/* Item text */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      text-sm sm:text-base leading-relaxed transition-all duration-300
                      ${isChecked 
                        ? 'line-through text-slate-400' 
                        : 'text-[#062e39] font-medium'
                      }
                    `}
                  >
                    {item}
                  </span>
                </div>

                {/* Animated check indicator */}
                {isChecked && (
                  <div className="shrink-0 flex items-center gap-1">
                    <span className="text-xs font-bold text-emerald-500 animate-fadeIn">
                      Done!
                    </span>
                  </div>
                )}
              </label>
            );
          })}
        </div>

        {/* Motivational message on completion */}
        {isComplete && justCompleted && (
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 animate-slideUp">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold text-emerald-800 text-sm sm:text-base">
                  Amazing work!
                </p>
                <p className="text-xs sm:text-sm text-emerald-600 mt-1">
                  You've completed all {items.length} items. Keep up the great progress!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes checklistConfetti {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0); opacity: 0; }
        }
        
        @keyframes checkMark {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(0deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes itemCheck {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        .animate-checkMark {
          animation: checkMark 0.3s ease-out;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.5s ease-out;
        }
        
        .animate-itemCheck {
          animation: itemCheck 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
