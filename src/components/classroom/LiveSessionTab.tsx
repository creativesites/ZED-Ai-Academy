"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Video, Play, Power, ShieldCheck, Loader2, Sparkles, Copy,
  CheckCircle2, AlertCircle, Calendar
} from "lucide-react";
import { JaaSMeeting } from '@jitsi/react-sdk';
import { generateJitsiToken } from "@/actions/jitsi";
import { toggleClassroomSession, getCompanySessionState, getClassSchedules, getCompanyStudents, markAttendance, getSessionAttendance } from "@/actions/classroom";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function LiveSessionTab({ companyId, isAdminOrInstructor, companySlug }: { companyId: string, isAdminOrInstructor: boolean, companySlug: string }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [swUnregistered, setSwUnregistered] = useState(false);

  const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";  

  // Real-time synchronization
  useEffect(() => {
    async function load() {
      const state = await getCompanySessionState(companyId);
      setIsSessionActive(state.is_session_active);
      setRoomName(state.active_room_name);
      setActiveScheduleId(state.active_schedule_id);

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
    }
    load();

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
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 0) {
          console.log(`Found ${registrations.length} service workers. Unregistering...`);
          Promise.all(registrations.map(r => r.unregister())).then(() => {
            console.log("Service workers unregistered. Reloading to clear state...");
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
  async function handleStartSession() {
    setIsInitializing(true);
    setError(null);
    try {
      const generatedRoom = `classroom-${companySlug}-${Math.random().toString(36).slice(2, 7)}`;
      // 1. Persist state to Supabase first
      await toggleClassroomSession(companyId, companySlug, true, generatedRoom, selectedScheduleId);
      
      // 2. Generate token
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
      // Cleanup on fail
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50">
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

  if (!isSessionActive && !isAdminOrInstructor) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="relative mb-8">
           <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
           <div className="relative h-24 w-24 rounded-3xl bg-white shadow-xl border border-slate-100 flex items-center justify-center">
             <Video className="h-10 w-10 text-slate-300" />
           </div>
        </div>
        <h2 className="text-3xl font-black text-[#062e39] tracking-tight">Waiting for Instructor</h2>
        <p className="mt-4 text-slate-500 max-w-sm leading-relaxed">
          The virtual classroom is currently closed. Your instructor will notify you once the live session begins.
        </p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 text-center relative overflow-hidden">
          <div className="mb-8 flex h-20 w-20 mx-auto items-center justify-center rounded-3xl bg-[#fd5523]/10 text-[#fd5523] shadow-inner">
            <Video className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-black text-[#062e39] mb-3 tracking-tight">
            {isAdminOrInstructor && !isSessionActive ? "Start Live Session" : "Virtual Classroom"}
          </h2>
          
          {isAdminOrInstructor && !isSessionActive && (
            <div className="mb-6 text-left">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Select Class Session</label>
              <select 
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#fd5523]/20"
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
            className="w-full h-16 rounded-2xl bg-[#fd5523] text-white font-black text-xl hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/20 transition-all"
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

  const activeSchedule = schedules.find(s => s.id === activeScheduleId);

  return (
    <div className="flex h-full flex-col bg-[#062e39] text-white relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 bg-black/30 border-b border-white/5 z-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            Live
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">{companySlug} STUDIO</span>
          {activeSchedule && (
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-white/70 text-[10px] font-black uppercase tracking-widest border border-white/10">
               <Calendar className="h-3 w-3" /> {activeSchedule.title}
             </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdminOrInstructor && activeSchedule && (
             <Button 
               variant="outline" 
               size="sm" 
               className="bg-white/5 hover:bg-white/10 text-white border-white/10 text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-xl transition-all" 
               onClick={() => setShowAttendance(!showAttendance)}
             >
               <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Attendance
             </Button>
          )}
          {isAdminOrInstructor && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-xl transition-all" 
              onClick={handleEndSession}
            >
              <Power className="h-3.5 w-3.5 mr-2" /> End Class
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-black relative flex">
        <div className="flex-1 relative">
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
                  <p className="text-sm font-black uppercase tracking-widest">Entering Studio...</p>
                </div>
              )}
            />
          )}
        </div>

        {/* Attendance Sidebar */}
        {showAttendance && activeSchedule && (
          <div className="w-80 bg-[#062e39] border-l border-white/5 flex flex-col shrink-0">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-sm uppercase tracking-widest text-white/90">Mark Attendance</h3>
              <p className="text-xs text-white/50 mt-1">For {activeSchedule.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {students.map((student) => {
                  const record = attendance.find(a => a.profile_id === student.id);
                  const status = record?.status || "present";
                  return (
                    <div key={student.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-3">
                       <div className="flex items-center gap-2">
                         <div className="h-6 w-6 rounded-md bg-white/10 overflow-hidden">
                           {student.avatar_url && <img src={student.avatar_url} className="h-full w-full object-cover" />}
                         </div>
                         <span className="text-sm font-bold text-white line-clamp-1">{student.full_name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              await markAttendance(companyId, activeSchedule.id, student.id, "present", companySlug);
                              setAttendance(await getSessionAttendance(companyId, activeSchedule.id));
                            }}
                            className={`flex-1 h-7 text-[9px] font-black uppercase tracking-widest rounded-lg ${status === "present" ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                          >
                            Present
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              await markAttendance(companyId, activeSchedule.id, student.id, "late", companySlug);
                              setAttendance(await getSessionAttendance(companyId, activeSchedule.id));
                            }}
                            className={`flex-1 h-7 text-[9px] font-black uppercase tracking-widest rounded-lg ${status === "late" ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                          >
                            Late
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              await markAttendance(companyId, activeSchedule.id, student.id, "absent", companySlug);
                              setAttendance(await getSessionAttendance(companyId, activeSchedule.id));
                            }}
                            className={`flex-1 h-7 text-[9px] font-black uppercase tracking-widest rounded-lg ${status === "absent" ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                          >
                            Absent
                          </Button>
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
