"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, User, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

export function TimetableCalendar({ schedules }: { schedules: any[] }) {
  // 1 is Monday in your database logic (dayIdx + 1)
  const [activeDayIdx, setActiveDayIdx] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[650px] lg:h-[700px]">
      
      {/* --- MOBILE HEADER: Day Navigation --- */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <button 
          onClick={() => setActiveDayIdx((prev) => (prev === 0 ? 6 : prev - 1))}
          className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        
        <div className="text-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39]">
            {DAYS[activeDayIdx]}
          </h3>
          <p className="text-[10px] font-bold text-[#fd5523] uppercase">Daily Schedule</p>
        </div>

        <button 
          onClick={() => setActiveDayIdx((prev) => (prev === 6 ? 0 : prev + 1))}
          className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm active:scale-90 transition-transform"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* --- DESKTOP HEADER: Grid Days --- */}
      <div className="hidden lg:grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
        <div className="p-4 border-r border-slate-100"></div>
        {DAYS.map((day, idx) => (
          <div 
            key={day} 
            className={cn(
              "p-4 text-center border-r border-slate-100 last:border-r-0 transition-colors",
              activeDayIdx === idx && "bg-white"
            )}
          >
            <span className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em]",
              activeDayIdx === idx ? "text-[#fd5523]" : "text-slate-400"
            )}>
              {day}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative scrollbar-hide">
        <div className="grid grid-cols-1 lg:grid-cols-8 min-h-full">
          
          {/* Time Column (Always visible on Desktop, Hidden/Sticky on Mobile) */}
          <div className="hidden lg:block border-r border-slate-100 bg-slate-50/10">
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-100/50 p-3 text-right">
                <span className="text-[10px] font-black text-slate-400 tabular-nums">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* 
              Day Columns 
              Mobile: Only show the 'activeDayIdx'
              Desktop: Show all 7 columns
          */}
          {Array.from({ length: 7 }).map((_, dayIdx) => {
            const isMobileHidden = activeDayIdx !== dayIdx;
            
            return (
              <div 
                key={dayIdx} 
                className={cn(
                  "relative border-r border-slate-100 last:border-r-0 group hover:bg-slate-50/30 transition-colors min-h-[1120px] lg:min-h-0",
                  isMobileHidden ? "hidden lg:block" : "block"
                )}
              >
                {/* Background Grid Lines */}
                {HOURS.map((hour) => (
                  <div key={hour} className="h-20 border-b border-slate-50 flex items-start p-3 lg:p-0">
                    {/* Mobile-only time markers inside the column */}
                    <span className="lg:hidden text-[9px] font-black text-slate-300 tabular-nums">
                      {hour}:00
                    </span>
                  </div>
                ))}
                
                {/* Render Lessons */}
                {schedules
                  .filter((s) => s.day_of_week === dayIdx + 1)
                  .map((lesson) => {
                    if (!lesson.start_time_only || !lesson.end_time_only) return null;
                    const [startH, startM] = lesson.start_time_only.split(":").map(Number);
                    const [endH, endM] = lesson.end_time_only.split(":").map(Number);
                    
                    // Calculation: (Hour - StartOffset) * PixelsPerHour + MinutesOffset
                    const top = (startH - 8) * 80 + (startM / 60) * 80;
                    const height = ((endH - startH) * 60 + (endM - startM)) * (80 / 60);

                    return (
                      <div
                        key={lesson.id}
                        className="absolute left-2 right-2 lg:left-1.5 lg:right-1.5 rounded-2xl p-4 lg:p-3 overflow-hidden border border-[#fd5523]/20 shadow-md lg:shadow-sm transition-all hover:z-10 hover:scale-[1.02] lg:hover:scale-[1.03] group/lesson cursor-pointer"
                        style={{ 
                          top: `${top}px`, 
                          height: `${height}px`,
                          backgroundColor: "#fff6ee",
                          color: "#fd5523"
                        }}
                      >
                        <div className="flex flex-col h-full justify-between">
                          <div>
                            <div className="font-black text-xs lg:text-[10px] truncate uppercase tracking-tight leading-tight mb-1">
                              {lesson.title}
                            </div>
                            <div className="opacity-70 flex items-center gap-1.5 font-bold text-[10px] lg:text-[9px]">
                              <Clock className="h-3 w-3 lg:h-2.5 lg:w-2.5" />
                              {lesson.start_time_only.slice(0, 5)} - {lesson.end_time_only.slice(0, 5)}
                            </div>
                          </div>
                          
                          {/* Desktop/Tablet extra info */}
                          {height > 100 && (
                            <div className="mt-auto pt-2 border-t border-[#fd5523]/10 hidden sm:flex items-center gap-2">
                               <div className="h-5 w-5 rounded-full bg-[#fd5523] text-white flex items-center justify-center">
                                 <BookOpen className="h-2.5 w-2.5" />
                               </div>
                               <span className="text-[8px] font-black uppercase tracking-tighter opacity-80">View Lesson</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MOBILE FOOTER: Day Legend --- */}
      <div className="lg:hidden p-4 bg-white border-t border-slate-100 flex justify-center gap-1">
        {DAYS.map((day, idx) => (
          <div 
            key={day}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              activeDayIdx === idx ? "bg-[#fd5523] grow-[2]" : "bg-slate-100"
            )}
          />
        ))}
      </div>
    </div>
  );
}