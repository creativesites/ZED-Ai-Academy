"use client";

import { cn } from "@/lib/utils";
import { Clock, User, BookOpen } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

export function TimetableCalendar({ schedules }: { schedules: any[] }) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
      <div className="grid grid-cols-8 border-b border-slate-50 bg-slate-50/50">
        <div className="p-4 border-r border-slate-100"></div>
        {DAYS.map((day) => (
          <div key={day} className="p-4 text-center border-r border-slate-100 last:border-r-0">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{day}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="grid grid-cols-8 min-h-full">
          {/* Time Column */}
          <div className="border-r border-slate-100 bg-slate-50/20">
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-50 p-2 text-right">
                <span className="text-[10px] font-black text-slate-300">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {Array.from({ length: 7 }).map((_, dayIdx) => (
            <div key={dayIdx} className="relative border-r border-slate-100 last:border-r-0 group hover:bg-slate-50/30 transition-colors">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-slate-50"></div>
              ))}
              
              {/* Render Lessons */}
              {schedules
                .filter((s) => s.day_of_week === dayIdx + 1)
                .map((lesson) => {
                  const [startH, startM] = lesson.start_time_only.split(":").map(Number);
                  const [endH, endM] = lesson.end_time_only.split(":").map(Number);
                  
                  const top = (startH - 8) * 80 + (startM / 60) * 80;
                  const height = ((endH - startH) * 60 + (endM - startM)) * (80 / 60);

                  return (
                    <div
                      key={lesson.id}
                      className="absolute left-1 right-1 rounded-xl p-2 text-[10px] overflow-hidden border border-[#fd5523]/20 shadow-sm transition-all hover:z-10 hover:scale-[1.02] hover:shadow-lg"
                      style={{ 
                        top: `${top}px`, 
                        height: `${height}px`,
                        backgroundColor: "#fff6ee",
                        color: "#fd5523"
                      }}
                    >
                      <div className="font-black truncate uppercase tracking-tight">{lesson.title}</div>
                      <div className="opacity-70 flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {lesson.start_time_only.slice(0, 5)}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
