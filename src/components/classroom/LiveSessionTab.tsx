"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Video, Play, Power, ShieldCheck, Loader2, Sparkles, Copy,
  CheckCircle2, AlertCircle, Calendar, X, ChevronUp, UserCheck, Users
} from "lucide-react";
import { JaaSMeeting } from '@jitsi/react-sdk';
import { generateJitsiToken } from "@/actions/jitsi";
import { 
  toggleClassroomSession, 
  getCompanySessionState, 
  getClassSchedules, 
  getCompanyStudents, 
  markAttendance, 
  getSessionAttendance,
  markAutoAttendance
} from "@/actions/classroom";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LiveSessionTabProps {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
}

export function LiveSessionTab({ companyId, isAdminOrInstructor, companySlug }: LiveSessionTabProps) {
  // --- State Management ---
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [swUnregistered, setSwUnregistered] = useState(false);

  const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";  

  // --- Effect: Sync Session State & Data ---
  useEffect(() => {
    async function loadInitialData() {
      try {
        const state = await getCompanySessionState(companyId);
        setIsSessionActive(state.is_session_active);
        setRoomName(state.active_room_name);
        setActiveScheduleId(state.active_schedule_id);
        setActiveSessionId(state.active_session_id);

        if (isAdminOrInstructor) {
          const [schs, stus] = await Promise.all([
            getClassSchedules(companyId),
            getCompanyStudents(companyId)
          ]);
          setSchedules(schs);
          setStudents(stus);
          
          if (state.active_schedule_id) {
             const att = await getSessionAttendance(companyId, state.active_schedule_id);
             setAttendance(att);
          }
        }
      } catch (err) {
        console.error("Error loading classroom data:", err);
      }
    }
    
    loadInitialData();

    // Real-time Supabase Subscription
    const supabase = createClient();
    const channel = supabase
      .channel('company-session')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'companies',
        filter: `id=eq.${companyId}`
      }, (payload) => {
        setIsSessionActive(payload.new.is_session_active);
        setRoomName(payload.new.active_room_name);
        setActiveScheduleId(payload.new.active_schedule_id);
        setActiveSessionId(payload.new.active_session_id);
        
        // Auto-kick if session is ended by instructor
        if (!payload.new.is_session_active) {
          setHasJoined(false);
          setJwt(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, isAdminOrInstructor]);

  // --- Effect: Auto Attendance ---
  useEffect(() => {
    if (hasJoined && !isAdminOrInstructor && activeSessionId) {
      markAutoAttendance(companyId, activeSessionId, activeScheduleId).catch(console.error);
    }
  }, [hasJoined, isAdminOrInstructor, activeSessionId, companyId, activeScheduleId]);

  // --- Effect: Service Worker Cleanup (Jitsi Stability) ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 0) {
          Promise.all(registrations.map(r => r.unregister())).then(() => {
            setSwUnregistered(true);
            window.location.reload();
          });
        } else {
          setSwUnregistered(true);
        }
      });
    } else {
      setSwUnregistered(true);
    }
  }, []);

  // --- Handlers ---
  async function handleStartSession() {
    setIsInitializing(true);
    setError(null);
    try {
      const generatedRoom = `classroom-${companySlug}-${Math.random().toString(36).slice(2, 7)}`;
      
      // 1. Persist state to Database
      await toggleClassroomSession(companyId, companySlug, true, generatedRoom, selectedScheduleId);
      
      // 2. Generate Security Token
      const result = await generateJitsiToken(generatedRoom, true);
      
      if (result.success && result.token) {
        setJwt(result.token);
        setRoomName(generatedRoom);
        setActiveScheduleId(selectedScheduleId);
        setHasJoined(true);
        toast.success("Live Classroom Started!");
      } else {
        throw new Error(result.error || "Failed to generate security token");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initialize studio");
      toast.error("Failed to start live session");
      await toggleClassroomSession(companyId, companySlug, false);
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleJoinSession() {
    if (!roomName) {
       toast.error("No active room found");
       return;
    }
    setIsInitializing(true);
    setError(null);
    try {
      const result = await generateJitsiToken(roomName, false);
      if (result.success && result.token) {
        setJwt(result.token);
        setHasJoined(true);
      } else {
        throw new Error(result.error || "Failed to join studio");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to studio");
      toast.error("Failed to join session");
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleEndSession() {
    try {
      await toggleClassroomSession(companyId, companySlug, false);
      setHasJoined(false);
      setJwt(null);
      setRoomName(null);
      toast.success("Session Ended");
    } catch (e) {
      toast.error("Failed to end session properly");
    }
  }

  const handleMarkAttendance = async (studentId: string, status: "present" | "late" | "absent") => {
    if (!activeScheduleId) return;
    try {
      await markAttendance(companyId, activeScheduleId, studentId, status, companySlug);
      const updatedAttendance = await getSessionAttendance(companyId, activeScheduleId);
      setAttendance(updatedAttendance);
    } catch (error) {
      toast.error("Failed to update attendance");
    }
  };

  // --- Conditional Renders: Error State ---
  if (error) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="h-20 w-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black text-[#062e39]">Connection Error</h2>
        <p className="mt-2 text-slate-500 max-w-xs">{error}</p>
        <Button 
          variant="outline" 
          className="mt-6 rounded-xl border-[#fd5523] text-[#fd5523] hover:bg-[#fd5523]/5"
          onClick={() => setError(null)}
        >
          Try Again
        </Button>
      </div>
    );
  }

  // --- Conditional Renders: Inactive State (Student View) ---
  if (!isSessionActive && !isAdminOrInstructor) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="relative mb-8">
           <div className="absolute -inset-4 bg-[#fd5523]/10 rounded-full blur-2xl animate-pulse" />
           <div className="relative h-24 w-24 rounded-3xl bg-white shadow-xl border border-slate-100 flex items-center justify-center">
             <Video className="h-10 w-10 text-slate-300" />
           </div>
        </div>
        <h2 className="text-3xl font-black text-[#062e39] tracking-tight">Classroom is Closed</h2>
        <p className="mt-4 text-slate-500 max-w-sm leading-relaxed">
          The instructor has not started the live session yet. You will be able to join as soon as they go live.
        </p>
      </div>
    );
  }

  // --- Conditional Renders: Join/Start Screen ---
  if (!hasJoined) {
    return (
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center p-4 lg:p-8 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[2rem] lg:rounded-[2.5rem] p-8 lg:p-10 shadow-2xl border border-slate-100 text-center relative overflow-hidden">
          <div className="mb-8 flex h-20 w-20 mx-auto items-center justify-center rounded-3xl bg-[#fd5523]/10 text-[#fd5523] shadow-inner">
            <Video className="h-10 w-10" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-[#062e39] mb-3 tracking-tight">
            {isAdminOrInstructor && !isSessionActive ? "Start Live Session" : "Virtual Classroom"}
          </h2>
          
          {isAdminOrInstructor && !isSessionActive && (
            <div className="mb-6 text-left">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2 block ml-1">
                Attach to Schedule
              </label>
              <select 
                className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#fd5523]/20 transition-all appearance-none"
                value={selectedScheduleId || ""}
                onChange={(e) => setSelectedScheduleId(e.target.value || null)}
              >
                <option value="">Unscheduled Session</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.is_recurring ? `(Every ${s.day_of_week})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button 
            onClick={isAdminOrInstructor && !isSessionActive ? handleStartSession : handleJoinSession}
            disabled={isInitializing}
            className="w-full h-16 rounded-2xl bg-[#fd5523] text-white font-black text-lg lg:text-xl hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/20 transition-all active:scale-[0.98]"
          >
            {isInitializing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              isAdminOrInstructor && !isSessionActive ? "Start Class Now" : "Join Room"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- Main Render: Active Session Studio ---
  const activeSchedule = schedules.find(s => s.id === activeScheduleId);

  return (
    <div className="flex h-full w-full flex-col bg-[#062e39] text-white relative overflow-hidden">
      {/* 
          1. Header Section 
          - Stacked on Mobile, Row on Desktop
      */}
      <div className="sticky top-0 z-40 w-full flex flex-col bg-[#062e39]/80 backdrop-blur-md border-b border-white/10">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 lg:h-20">
          
          {/* Brand & Status Section */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-500">Live</span>
            </div>
            
            <div className="flex flex-col min-w-0">
              <p className="text-xs lg:text-sm font-black text-white uppercase tracking-wider truncate">
                {companySlug} <span className="text-white/40 font-medium">Studio</span>
              </p>
              {/* Mobile-only Schedule indicator (under the title) */}
              {activeSchedule && (
                <div className="lg:hidden flex items-center gap-1 text-[9px] font-bold text-white/40 uppercase tracking-tighter truncate">
                  <span className="text-[#fd5523] opacity-100">●</span> {activeSchedule.title}
                </div>
              )}
            </div>
          </div>

          {/* Admin Actions Section */}
          <div className="flex items-center gap-2">
            {isAdminOrInstructor && (
              <>
                {/* Attendance Button - Compact on Mobile */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 sm:w-auto sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 border-white/10 text-white transition-all active:scale-95"
                  onClick={() => setShowAttendance(true)}
                >
                  <UserCheck className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Attendance</span>
                </Button>

                {/* End Session - Red accent used carefully */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 w-9 sm:w-auto sm:px-4 rounded-xl bg-red-500/10 hover:bg-red-500 border-red-500/20 text-red-500 hover:text-white transition-all active:scale-95"
                  onClick={handleEndSession}
                >
                  <Power className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">End Session</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Desktop-only secondary bar for schedule details */}
        {activeSchedule && (
          <div className="hidden lg:flex items-center px-6 py-2 bg-black/20 border-t border-white/5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">
              <Calendar className="h-3 w-3 text-[#fd5523]" />
              <span>Currently Scheduled:</span>
              <span className="text-white">{activeSchedule.title}</span>
            </div>
          </div>
        )}
      </div>

      {/* 
          2. Content Area 
          - Video occupies full space
      */}
      <div className="flex-1 relative flex min-h-0">
        {/* Jitsi Video Container */}
        <div className="flex-1 relative bg-black min-h-[500px]">
          {roomName && jwt && (
            <JaaSMeeting
              appId={APP_ID}
              roomName={roomName}
              jwt={jwt}
              configOverwrite={{
                startWithAudioMuted: true,
                disableInviteFunctions: true,
                enableWelcomePage: false,
                prejoinPageEnabled: false,
                backgroundColor: '#062e39',
              }}
              onReadyToClose={() => setHasJoined(false)}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }}
              spinner={() => (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50 bg-[#062e39]">
                  <Loader2 className="h-10 w-10 animate-spin text-[#fd5523]" />
                  <p className="text-xs font-black uppercase tracking-widest">Configuring Studio...</p>
                </div>
              )}
            />
          )}
        </div>

        {/* 
            4. Attendance Panel 
            - Slides in from right
        */}
        <div className={cn(
          // MOBILE: Full screen fixed overlay | DESKTOP: Static inline sidebar
          "fixed inset-0 lg:static z-[100] lg:z-10 w-full bg-[#062e39]/95 lg:bg-[#062e39] backdrop-blur-xl lg:backdrop-blur-none flex flex-col transition-all duration-500 ease-in-out border-l border-white/10 shadow-2xl lg:shadow-none shrink-0 overflow-hidden",
          showAttendance 
            ? "translate-y-0 opacity-100 lg:w-96 lg:translate-y-0" 
            : "translate-y-full opacity-0 lg:w-0 lg:border-none lg:translate-y-0"
        )}>
          
          {/* Header: Polished with a "Handle" for Mobile UI feel */}
          <div className="relative p-6 border-b border-white/5 bg-black/40 lg:bg-transparent shrink-0">
            {/* Mobile Grab Handle */}
            <div className="lg:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full" />
            
            <div className="flex items-center justify-between mt-2 lg:mt-0">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#fd5523] animate-pulse" />
                  <h3 className="font-black text-sm uppercase tracking-[0.2em] text-white">Attendance</h3>
                </div>
                <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-widest flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  {students.length} Students Enrolled
                </p>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all" 
                onClick={() => setShowAttendance(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Student List: Using a "Card-in-Card" aesthetic */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 scrollbar-hide">
            {students.map((student) => {
                const record = attendance.find(a => a.profile_id === student.id);
                const status = record?.status || "present";
                
                return (
                  <div 
                    key={student.id} 
                    className="group relative bg-gradient-to-b from-white/[0.08] to-transparent p-4 rounded-[2rem] border border-white/10 transition-all hover:border-[#fd5523]/30"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-[1.25rem] bg-gradient-to-br from-white/20 to-white/5 overflow-hidden ring-2 ring-white/10 shrink-0 shadow-xl">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} className="h-full w-full object-cover" alt={student.full_name} />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs font-black text-white/50">
                              {student.full_name?.split(' ').map((n:any) => n[0]).join('')}
                            </div>
                          )}
                        </div>
                        {/* Status Indicator Dot */}
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#062e39] shadow-lg",
                          status === 'present' ? "bg-emerald-500" : status === 'late' ? "bg-amber-500" : "bg-red-500"
                        )} />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-white tracking-tight truncate">{student.full_name}</span>
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified Student
                        </span>
                      </div>
                    </div>

                    {/* Action Grid: High-contrast buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        {(['present', 'late', 'absent'] as const).map((s) => (
                          <button 
                            key={s}
                            onClick={() => handleMarkAttendance(student.id, s)}
                            className={cn(
                              "h-10 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 border flex flex-col items-center justify-center gap-0.5",
                              status === s 
                                ? s === 'present' 
                                  ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                                  : s === 'late'
                                    ? "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20"
                                    : "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20"
                                : "bg-white/5 border-white/5 text-white/30 hover:bg-white/10 hover:border-white/10"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                    </div>
                  </div>
                );
            })}

            {/* Empty State */}
            {students.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center opacity-20">
                <Users className="h-12 w-12 text-white mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">No data found</p>
              </div>
            )}
          </div>

          {/* Mobile Bottom Padding to clear navigation bars */}
          <div className="h-20 lg:hidden shrink-0" />
        </div>
      </div>
    </div>
  );
}