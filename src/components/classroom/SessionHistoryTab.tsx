"use client";

import { useEffect, useState } from "react";
import { Clock, Users, CalendarDays, History, Play, CheckCircle2, UserCheck } from "lucide-react";
import { getSessionHistory } from "@/actions/classroom";
export function SessionHistoryTab({ companyId }: { companyId: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }).replace(',', ' •');
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getSessionHistory(companyId);
        setSessions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-8 bg-slate-50/50">
        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4">
          <History className="h-6 w-6 text-slate-400 animate-pulse" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading History...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="h-20 w-20 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-6">
          <History className="h-10 w-10 text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-[#062e39] mb-2 tracking-tight">No Session History</h2>
        <p className="text-slate-500 max-w-sm">Past live sessions and their attendance records will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/30">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#fd5523]/10 text-[#fd5523]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#062e39] tracking-tight leading-none">Session History</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Past Classroom Events & Attendance</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessionId === session.id;
          const startedAt = new Date(session.started_at);
          const endedAt = session.ended_at ? new Date(session.ended_at) : null;
          const duration = endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000) : null;

          return (
            <div key={session.id} className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm transition-all hover:shadow-md">
              <div 
                className="p-5 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#062e39] tracking-tight">{session.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(startedAt)}
                      </span>
                      {duration !== null ? (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
                          {duration} mins
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full">
                          Ongoing
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto border-t lg:border-none border-slate-100 pt-4 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {Array.from({ length: Math.min(3, session.attendance_count) }).map((_, i) => (
                        <div key={i} className="h-8 w-8 rounded-full bg-[#062e39] border-2 border-white flex items-center justify-center">
                          <UserCheck className="h-3 w-3 text-white" />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col ml-2">
                      <span className="text-sm font-black text-[#fd5523]">{session.attendance_count}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Attended</span>
                    </div>
                  </div>
                  <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#062e39] transition-colors">
                    {isExpanded ? "Hide Details" : "View Details"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Attendance Roster</h4>
                  {session.attendance_records?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {session.attendance_records.map((record: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100">
                          <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#062e39] truncate">Student ID: {record.profile_id.slice(0, 8)}</p>
                            <p className="text-[10px] font-bold uppercase text-emerald-500 tracking-widest">Present</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No attendance records found for this session.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
