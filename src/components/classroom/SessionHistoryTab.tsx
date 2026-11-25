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
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-6 text-center bg-slate-50/50">
        <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center mb-4">
          <History className="h-7 w-7 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-1.5 tracking-tight">No Session History</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm">Past live sessions and their attendance records will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/30">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand/10 text-brand-text">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight leading-none">Session History</h2>
            <p className="text-[11px] font-medium text-slate-400 mt-1">Past Classroom Events &amp; Attendance</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-3">
        {sessions.map((session) => {
          const isExpanded = expandedSessionId === session.id;
          const startedAt = new Date(session.started_at);
          const endedAt = session.ended_at ? new Date(session.ended_at) : null;
          const duration = endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000) : null;

          return (
            <div key={session.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs transition-all hover:shadow-sm">
              <div 
                className="p-4 sm:p-5 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3.5"
                onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
              >
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-ink tracking-tight truncate">{session.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(startedAt)}
                      </span>
                      {duration !== null ? (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {duration} mins
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Ongoing
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto border-t lg:border-none border-slate-100 pt-3 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {Array.from({ length: Math.min(3, session.attendance_count) }).map((_, i) => (
                        <div key={i} className="h-7 w-7 rounded-full bg-ink border-2 border-white flex items-center justify-center">
                          <UserCheck className="h-3 w-3 text-white" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-baseline gap-1.5 ml-1">
                      <span className="text-sm font-bold text-brand-text">{session.attendance_count}</span>
                      <span className="text-[11px] font-semibold text-slate-400">Attended</span>
                    </div>
                  </div>
                  <button type="button" className="text-xs font-semibold text-slate-500 hover:text-brand-text transition-colors">
                    {isExpanded ? "Hide Details" : "View Details"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Attendance Roster</h4>
                  {session.attendance_records?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {session.attendance_records.map((record: any, idx: number) => {
                        const studentName =
                          record.profile?.full_name ||
                          record.profile?.email ||
                          `Student ${String(record.profile_id || "").slice(0, 8)}`;
                        const statusLabel = record.status || "present";
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
                            <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold">
                              {record.profile?.avatar_url ? (
                                <img src={record.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                studentName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-ink truncate">{studentName}</p>
                              <p className="text-[10px] font-semibold uppercase text-emerald-600 tracking-wider">{statusLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No attendance records found for this session.</p>
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
