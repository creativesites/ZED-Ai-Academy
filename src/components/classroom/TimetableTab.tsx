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
    <div className="min-h-screen bg-slate-50/50">
      {/* Mobile-first container with responsive padding */}
      <div className="px-4 py-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Header Section - Stack on mobile, row on tablet+ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              School Timetable
              <BookOpen className="h-5 w-5 text-[#fd5523]" />
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Weekly recurring class schedule and subjects.
            </p>
          </div>
          
          {isAdminOrInstructor && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={(props) => (
                <Button {...props} className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-xl flex items-center gap-2 shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-[1.02] w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Subject
                </Button>
              )} />
              <DialogContent className="sm:max-w-[600px] rounded-[2rem] overflow-hidden w-[95vw] sm:w-full mx-auto">
                <div className="p-1 px-4 bg-gradient-to-r from-[#fd5523] to-orange-400 h-1" />
                <DialogHeader className="pt-6 px-4 sm:px-6">
                  <DialogTitle className="text-xl sm:text-2xl font-black text-[#062e39]">Create New Subject</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6 overflow-y-auto max-h-[80vh]">
                  <div className="space-y-5">
                    {/* Responsive grid - 1 column on mobile, 2 on tablet+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="flex items-center space-x-2 mt-0 sm:mt-6 h-12">
                        <Checkbox id="recurring" checked={isRecurring} onCheckedChange={(v) => setIsRecurring(!!v)} />
                        <label htmlFor="recurring" className="text-sm font-bold text-slate-700 cursor-pointer">Recurring Weekly</label>
                      </div>
                    </div>

                    {isRecurring ? (
                      <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repeat Every</label>
                          {/* Responsive day grid - scrollable on mobile */}
                          <div className="overflow-x-auto pb-2 -mx-1">
                            <div className="grid grid-cols-7 gap-1 min-w-[280px]">
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
                                    className="w-full text-center py-2 rounded-lg text-[10px] font-black cursor-pointer bg-white border border-slate-100 text-slate-400 peer-checked:bg-[#fd5523] peer-checked:text-[#fd7e14] peer-checked:border-[#fd5523] transition-all whitespace-nowrap px-2"
                                  >
                                    {day.slice(0, 3)}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-100 animate-in fade-in duration-300">
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
                    <Button type="submit" disabled={isPosting} className="w-full bg-[#fd5523] hover:bg-[#ef4a16] h-14 rounded-2xl text-white font-black text-base sm:text-lg shadow-xl shadow-[#fd5523]/20">
                      {isPosting ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" /> : null}
                      Save to Timetable
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Timetable Content */}
        <div className="space-y-8 sm:space-y-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#fd5523]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">Compiling School Timetable...</p>
            </div>
          ) : (
            <>
              {DAYS.map((day) => {
                const lessons = groupedSchedules[day];
                if (!lessons) return null;
                return (
                  <div key={day} className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Day Header - Responsive */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="px-4 py-1.5 rounded-full bg-[#062e39] text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg inline-block w-fit">
                        {day}
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent hidden sm:block" />
                    </div>
                    
                    {/* Lessons Grid - 1 column on mobile, 1 on tablet, responsive gap */}
                    <div className="grid grid-cols-1 gap-4 sm:gap-5">
                      {lessons.map((lesson) => (
                        <div key={lesson.id} className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#fd5523]/30 transition-all group relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                             <LayoutGrid className="h-24 w-24 sm:h-32 sm:w-32" />
                          </div>
                          
                          {/* Responsive layout - column on mobile, row on tablet+ */}
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 lg:gap-8">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 flex-1">
                              {/* Time Icon - Responsive sizing */}
                              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl sm:rounded-3xl bg-[#fd5523]/5 text-[#fd5523] flex flex-col items-center justify-center border-2 border-[#fd5523]/10 shrink-0 shadow-inner group-hover:bg-[#fd5523] group-hover:text-white transition-all duration-500">
                                 <Clock className="h-5 w-5 sm:h-7 sm:w-7 mb-1" />
                                 <span className="text-xs sm:text-sm font-black tracking-tighter">{lesson.start_time_only?.slice(0, 5)}</span>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                {/* Title and badges - responsive wrapping */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  <h4 className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors break-words">
                                    {lesson.title}
                                  </h4>
                                  <div className="px-2 py-1 sm:px-3 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                    {lesson.schedule_type?.replace('_', ' ')}
                                  </div>
                                  {lesson.group_id && (
                                    <div className="px-2 py-1 sm:px-3 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                                      <Users className="h-2 w-2 sm:h-3 sm:w-3" /> Class
                                    </div>
                                  )}
                                </div>
                                
                                {/* Instructor and time info - responsive */}
                                <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm text-slate-500 font-bold">
                                   <span className="flex items-center gap-1 sm:gap-2 bg-slate-50 px-2 py-1 sm:px-3 sm:py-1 rounded-full">
                                     <User className="h-3 w-3 sm:h-4 sm:w-4 text-[#fd5523]" /> 
                                     <span className="text-xs sm:text-sm">Instructor: You</span>
                                   </span>
                                   <span className="flex items-center gap-1 sm:gap-2 bg-slate-50 px-2 py-1 sm:px-3 sm:py-1 rounded-full">
                                     <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-[#fd5523]" /> 
                                     <span className="text-xs sm:text-sm">{lesson.start_time_only?.slice(0, 5)} — {lesson.end_time_only?.slice(0, 5)}</span>
                                   </span>
                                </div>
                                
                                {/* Topics section - responsive padding */}
                                {lesson.topics_covered && (
                                  <div className="mt-4 sm:mt-5 p-4 sm:p-5 rounded-2xl sm:rounded-[1.5rem] bg-indigo-50/20 border border-indigo-100/50 backdrop-blur-sm group-hover:bg-white group-hover:border-indigo-200 transition-all">
                                    <p className="text-[9px] sm:text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                      <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#fd5523]" /> Syllabus / Topics:
                                    </p>
                                    <p className="text-xs sm:text-sm text-indigo-700/80 leading-relaxed font-medium italic break-words">
                                      "{lesson.topics_covered}"
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Action Button - Full width on mobile, auto on desktop */}
                            <div className="mt-4 lg:mt-0 lg:ml-4">
                               <Button 
                                onClick={() => setSelectedLesson(lesson)}
                                className="w-full lg:w-auto h-10 sm:h-12 px-6 sm:px-8 rounded-xl bg-[#062e39] text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-[#fd5523] transition-all shadow-lg"
                               >
                                 View Details
                               </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Empty State - Mobile responsive */}
              {schedules.length === 0 && (
                <div className="text-center py-16 sm:py-24 bg-white rounded-3xl sm:rounded-[4rem] border-2 border-dashed border-slate-100">
                  <CalendarDays className="mx-auto h-16 w-16 sm:h-24 sm:w-24 text-slate-50 mb-6 sm:mb-8" />
                  <h3 className="text-2xl sm:text-3xl font-black text-[#062e39] px-4">Timetable Clear</h3>
                  <p className="text-slate-400 mt-2 font-bold max-w-xs mx-auto px-4 text-sm sm:text-base">
                    Your weekly school schedule will appear here once added by the instructor.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lesson Details Dialog - Mobile Responsive */}
      <Dialog open={!!selectedLesson} onOpenChange={() => setSelectedLesson(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl sm:rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl w-[95vw] sm:w-full mx-auto">
           <div className="bg-[#062e39] p-6 sm:p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 pointer-events-none">
                 <BookOpen className="h-32 w-32 sm:h-40 sm:w-40" />
              </div>
              <button onClick={() => setSelectedLesson(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                 <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[#fd5523] text-white text-[8px] sm:text-[10px] font-black uppercase tracking-widest inline-block mb-3 sm:mb-4">
                 {selectedLesson?.schedule_type?.replace('_', ' ')}
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-2 break-words">{selectedLesson?.title}</h2>
              <p className="text-white/60 font-bold flex items-center gap-2 text-sm sm:text-base">
                 <Clock className="h-3 w-3 sm:h-4 sm:w-4" /> Every {DAYS[(selectedLesson?.day_of_week || 1) - 1]} at {selectedLesson?.start_time_only?.slice(0, 5)}
              </p>
           </div>
           <div className="p-6 sm:p-10 bg-white space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                 <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#fd5523]">Learning Objectives</h4>
                 <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-100">
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium break-words">
                       {selectedLesson?.topics_covered || "No topics specified for this lesson."}
                    </p>
                 </div>
              </div>
              
              {/* Info cards - 1 column on mobile, 2 on tablet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                 <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 flex items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                       <User className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                       <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Instructor</p>
                       <p className="text-xs sm:text-sm font-black text-[#062e39]">Assigned Instructor</p>
                    </div>
                 </div>
                 <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 flex items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                       <Info className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                       <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                       <p className="text-xs sm:text-sm font-black text-[#062e39]">Confirmed</p>
                    </div>
                 </div>
              </div>

              {/* Action Buttons - Column on mobile, row on tablet */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                 <Button onClick={() => setSelectedLesson(null)} className="h-12 sm:h-14 rounded-2xl bg-slate-100 text-[#062e39] font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Close
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
                     }} className="h-12 sm:h-14 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
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
                     }} className="h-12 sm:h-14 rounded-2xl bg-red-50 text-red-600 font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100">
                        Cancel
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