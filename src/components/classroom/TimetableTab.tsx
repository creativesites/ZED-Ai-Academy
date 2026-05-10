"use client";

import { useState, useEffect } from "react";
import { 
  CalendarDays, Plus, Clock, Loader2, Calendar, BookOpen, 
  User, Sparkles, Filter, ChevronRight, X, Info, LayoutGrid,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClassSchedules, postClassSchedule, getClassroomGroups, deleteClassSchedule, duplicateClassSchedule } from "@/actions/classroom";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export function TimetableTab({ companyId, isAdminOrInstructor, companySlug }: { companyId: string, isAdminOrInstructor: boolean, companySlug: string }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);
  
  // Lesson Detail View
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);

  // Time Validation Helpers
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [schedulesData, groupsData] = await Promise.all([
          getClassSchedules(companyId),
          getClassroomGroups(companyId)
        ]);
        setSchedules(schedulesData);
        setGroups(groupsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  // Automatically suggest end time (e.g., +1 hour)
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (val) {
      const [h, m] = val.split(':').map(Number);
      const newH = (h + 1) % 24;
      const suggestedEnd = `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      setEndTime(suggestedEnd);
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPosting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);
    formData.append("isRecurring", String(isRecurring));

    try {
      await postClassSchedule(formData);
      toast.success("Schedule added successfully!");
      setOpen(false);
      const data = await getClassSchedules(companyId);
      setSchedules(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to add schedule");
    } finally {
      setIsPosting(false);
    }
  }

  const groupedSchedules = DAYS.reduce((acc, day, index) => {
    const dayLessons = schedules.filter(s => s.day_of_week === (index + 1));
    if (dayLessons.length > 0) acc[day] = dayLessons;
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex h-full flex-col p-6 bg-slate-50/50">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            School Timetable
            <BookOpen className="h-5 w-5 text-[#fd5523]" />
          </h2>
          <p className="text-sm text-slate-500 font-medium">Weekly recurring class schedule and subjects.</p>
        </div>
        
        {isAdminOrInstructor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={(props) => (
              <Button {...props} className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-xl flex items-center gap-2 shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-[1.02]">
                <Plus className="h-4 w-4" />
                Add Subject
              </Button>
            )} />
            <DialogContent className="sm:max-w-[600px] rounded-[2rem] overflow-hidden">
              <div className="p-1 px-4 bg-gradient-to-r from-[#fd5523] to-orange-400 h-1" />
              <DialogHeader className="pt-6 px-6">
                <DialogTitle className="text-2xl font-black text-[#062e39]">Create New Subject</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 p-6 overflow-y-auto max-h-[80vh]">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject Name</label>
                      <Input name="title" placeholder="e.g. Mathematics" required className="rounded-xl border-slate-100 bg-slate-50/50 h-12 focus:bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lesson Type</label>
                      <Select name="type" defaultValue="live_session">
                        <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50/50 h-12 focus:bg-white">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="live_session">Live Class</SelectItem>
                          <SelectItem value="workshop">Workshop</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Group (Class)</label>
                       <Select name="groupId" defaultValue="all">
                         <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50/50 h-12">
                           <SelectValue placeholder="All Students" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">All Students</SelectItem>
                           {groups.map(g => (
                             <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="flex items-center space-x-2 mt-6 h-12">
                      <Checkbox id="recurring" checked={isRecurring} onCheckedChange={(v) => setIsRecurring(!!v)} />
                      <label htmlFor="recurring" className="text-sm font-bold text-slate-700 cursor-pointer">Recurring Weekly</label>
                    </div>
                  </div>

                  {isRecurring ? (
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-4 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repeat Every</label>
                        <div className="grid grid-cols-7 gap-1">
                          {DAYS.map((day, i) => (
                            <div key={day} className="flex flex-col items-center">
                              <input 
                                type="radio" 
                                name="dayOfWeek" 
                                value={String(i + 1)} 
                                id={`day-${i}`} 
                                className="hidden peer" 
                                defaultChecked={i === 0}
                              />
                              <label 
                                htmlFor={`day-${i}`} 
                                className="w-full text-center py-2 rounded-lg text-[10px] font-black cursor-pointer bg-white border border-slate-100 text-slate-400 peer-checked:bg-[#fd5523] peer-checked:text-white peer-checked:border-[#fd5523] transition-all"
                              >
                                {day.slice(0, 3)}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Time</label>
                          <Input 
                            name="startTime" 
                            type="time" 
                            value={startTime}
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            required 
                            className="rounded-xl border-slate-100 bg-white h-12" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Time</label>
                          <Input 
                            name="endTime" 
                            type="time" 
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            required 
                            className="rounded-xl border-slate-100 bg-white h-12" 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 p-5 rounded-3xl bg-slate-50 border border-slate-100 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Starts At</label>
                        <Input name="startsAt" type="datetime-local" required className="rounded-xl border-slate-100 bg-white h-12" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ends At</label>
                        <Input name="endsAt" type="datetime-local" required className="rounded-xl border-slate-100 bg-white h-12" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Topics to be Covered</label>
                    <Textarea name="topics" placeholder="Enter lesson topics..." className="rounded-xl border-slate-100 bg-slate-50/50 resize-none h-24 p-4" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPosting} className="w-full bg-[#fd5523] hover:bg-[#ef4a16] h-14 rounded-2xl text-white font-black text-lg shadow-xl shadow-[#fd5523]/20">
                    {isPosting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
                    Save to Timetable
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#fd5523]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Compiling School Timetable...</p>
          </div>
        ) : (
          <>
            {DAYS.map((day) => {
              const lessons = groupedSchedules[day];
              if (!lessons) return null;
              return (
                <div key={day} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-1.5 rounded-full bg-[#062e39] text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg">
                      {day}
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                  </div>
                  <div className="grid gap-5">
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className="bg-white rounded-[2rem] p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#fd5523]/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                           <LayoutGrid className="h-32 w-32" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                          <div className="flex items-start gap-8 flex-1">
                            <div className="h-20 w-20 rounded-3xl bg-[#fd5523]/5 text-[#fd5523] flex flex-col items-center justify-center border-2 border-[#fd5523]/10 shrink-0 shadow-inner group-hover:bg-[#fd5523] group-hover:text-white transition-all duration-500">
                               <Clock className="h-7 w-7 mb-1" />
                               <span className="text-xs font-black tracking-tighter">{lesson.start_time_only?.slice(0, 5)}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h4 className="text-2xl font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors">{lesson.title}</h4>
                                <div className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                  {lesson.schedule_type?.replace('_', ' ')}
                                </div>
                                {lesson.group_id && (
                                  <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Class Assigned
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500 font-bold">
                                 <span className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full"><User className="h-4 w-4 text-[#fd5523]" /> Instructor: You</span>
                                 <span className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full"><Clock className="h-4 w-4 text-[#fd5523]" /> {lesson.start_time_only?.slice(0, 5)} — {lesson.end_time_only?.slice(0, 5)}</span>
                              </div>
                              {lesson.topics_covered && (
                                <div className="mt-5 p-5 rounded-[1.5rem] bg-indigo-50/20 border border-indigo-100/50 backdrop-blur-sm group-hover:bg-white group-hover:border-indigo-200 transition-all">
                                  <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-[#fd5523]" /> Syllabus / Topics:
                                  </p>
                                  <p className="text-sm text-indigo-700/80 leading-relaxed font-medium italic">"{lesson.topics_covered}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                             <Button 
                              onClick={() => setSelectedLesson(lesson)}
                              className="w-full md:w-auto h-12 px-8 rounded-xl bg-[#062e39] text-white font-black text-xs uppercase tracking-widest hover:bg-[#fd5523] transition-all shadow-lg"
                             >
                               View Full Details
                             </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {schedules.length === 0 && (
              <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                <CalendarDays className="mx-auto h-24 w-24 text-slate-50 mb-8" />
                <h3 className="text-3xl font-black text-[#062e39]">Timetable Clear</h3>
                <p className="text-slate-400 mt-2 font-bold max-w-xs mx-auto">Your weekly school schedule will appear here once added by the instructor.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lesson Details Dialog */}
      <Dialog open={!!selectedLesson} onOpenChange={() => setSelectedLesson(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl">
           <div className="bg-[#062e39] p-8 text-white relative">
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                 <BookOpen className="h-40 w-40" />
              </div>
              <button onClick={() => setSelectedLesson(null)} className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                 <X className="h-5 w-5" />
              </button>
              <div className="px-4 py-1.5 rounded-full bg-[#fd5523] text-white text-[10px] font-black uppercase tracking-widest inline-block mb-4">
                 {selectedLesson?.schedule_type?.replace('_', ' ')}
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-2">{selectedLesson?.title}</h2>
              <p className="text-white/60 font-bold flex items-center gap-2">
                 <Clock className="h-4 w-4" /> Every {DAYS[(selectedLesson?.day_of_week || 1) - 1]} at {selectedLesson?.start_time_only?.slice(0, 5)}
              </p>
           </div>
           <div className="p-10 bg-white space-y-8">
              <div className="space-y-4">
                 <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#fd5523]">Learning Objectives</h4>
                 <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                    <p className="text-slate-600 leading-relaxed font-medium">
                       {selectedLesson?.topics_covered || "No topics specified for this lesson."}
                    </p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 <div className="p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                       <User className="h-6 w-6" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instructor</p>
                       <p className="text-sm font-black text-[#062e39]">Assigned Instructor</p>
                    </div>
                 </div>
                 <div className="p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                       <Info className="h-6 w-6" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                       <p className="text-sm font-black text-[#062e39]">Confirmed</p>
                    </div>
                 </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                 <Button onClick={() => setSelectedLesson(null)} className="h-14 rounded-2xl bg-slate-100 text-[#062e39] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Close Details
                 </Button>
                 {isAdminOrInstructor && (
                   <>
                     <Button onClick={async () => {
                       if (!selectedLesson) return;
                       try {
                         await duplicateClassSchedule(selectedLesson.id, companySlug);
                         toast.success("Schedule duplicated");
                         setSelectedLesson(null);
                         const data = await getClassSchedules(companyId);
                         setSchedules(data);
                       } catch (e: any) {
                         toast.error(e.message);
                       }
                     }} className="h-14 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-sm uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                        Duplicate
                     </Button>
                     <Button onClick={async () => {
                       if (!selectedLesson) return;
                       try {
                         await deleteClassSchedule(selectedLesson.id, companySlug);
                         toast.success("Schedule deleted");
                         setSelectedLesson(null);
                         const data = await getClassSchedules(companyId);
                         setSchedules(data);
                       } catch (e: any) {
                         toast.error(e.message);
                       }
                     }} className="h-14 rounded-2xl bg-red-50 text-red-600 font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100">
                        Cancel Lesson
                     </Button>
                   </>
                 )}
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
