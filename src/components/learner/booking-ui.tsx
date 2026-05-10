"use client";

import * as React from "react";
import { 
  CalendarDays, 
  Clock3, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  ArrowRight,
  Info,
  Calendar as CalendarIcon,
  Loader2,
  MapPin,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestLiveSessionBooking } from "@/actions/live-sessions";
import { toast } from "sonner";

type LiveSessionSlot = {
  starts_at: string;
  ends_at: string;
  label: string;
};

type LiveSessionSlotDay = {
  date: string;
  label: string;
  slots: LiveSessionSlot[];
};

type BookingUIProps = {
  serviceId: string;
  courseId?: string;
  lessonId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

type Step = "date" | "time" | "details" | "success";

export function LiveSessionBookingUI({ serviceId, courseId, lessonId, onSuccess, onClose }: BookingUIProps) {
  const [step, setStep] = React.useState<Step>("date");
  const [loading, setLoading] = React.useState(true);
  const [service, setService] = React.useState<any>(null);
  const [days, setDays] = React.useState<LiveSessionSlotDay[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<LiveSessionSlot | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [timezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Calendar state
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/live-sessions/services/${serviceId}/slots?timezone=${encodeURIComponent(timezone)}`);
        if (!res.ok) throw new Error("Failed to fetch availability");
        const data = await res.json();
        setService(data.service);
        setDays(data.days);
      } catch (err) {
        toast.error("Could not load availability");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [serviceId, timezone]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setStep("time");
  };

  const handleSlotSelect = (slot: LiveSessionSlot) => {
    setSelectedSlot(slot);
    setStep("details");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("service_id", serviceId);
    formData.append("starts_at", selectedSlot.starts_at);
    formData.append("ends_at", selectedSlot.ends_at);
    formData.append("timezone", timezone);
    if (courseId) formData.append("course_id", courseId);
    if (lessonId) formData.append("lesson_id", lessonId);

    try {
      await requestLiveSessionBooking(formData);
      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to request booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-[#fd5523]" />
          <div className="absolute inset-0 animate-ping opacity-20">
            <Loader2 className="h-10 w-10 text-[#fd5523]" />
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-[#062e39] uppercase tracking-widest">Loading availability...</p>
      </div>
    );
  }

  const selectedDay = days.find(d => d.date === selectedDate);
  const availableDates = new Set(days.filter(d => d.slots.length > 0).map(d => d.date));

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = currentMonth.toLocaleString('default', { month: 'long' });

    const calendarDays = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`pad-${i}`} className="h-10 w-10" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAvailable = availableDates.has(dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      calendarDays.push(
        <button
          key={d}
          onClick={() => isAvailable && handleDateSelect(dateStr)}
          disabled={!isAvailable}
          className={cn(
            "relative h-10 w-10 rounded-full text-sm font-bold transition-all flex items-center justify-center",
            isAvailable 
              ? "text-[#062e39] hover:bg-[#fd5523]/10 hover:text-[#fd5523] cursor-pointer" 
              : "text-slate-200 cursor-not-allowed",
            isSelected && "bg-[#fd5523] text-white hover:bg-[#fd5523] hover:text-white ring-4 ring-[#fd5523]/10",
            isToday && !isSelected && "border-2 border-[#fd5523]/30 text-[#fd5523]"
          )}
        >
          {d}
          {isAvailable && !isSelected && (
            <div className="absolute bottom-1 h-1 w-1 rounded-full bg-[#fd5523]" />
          )}
        </button>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#062e39]">{monthName} {year}</h3>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => setCurrentMonth(new Date(year, month - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => setCurrentMonth(new Date(year, month + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <div key={d} className="text-[10px] font-black text-slate-400 py-2">{d}</div>
          ))}
          {calendarDays}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", step === "success" ? "bg-white" : "bg-slate-50/30")}>
      {/* Modal Header */}
      {step !== "success" && (
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== "date" && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full -ml-2"
                onClick={() => setStep(step === "details" ? "time" : "date")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#fd5523]">
                {step === "date" ? "Step 1 of 3" : step === "time" ? "Step 2 of 3" : "Step 3 of 3"}
              </p>
              <h2 className="text-sm font-bold text-[#062e39]">
                {step === "date" ? "Select a Date" : step === "time" ? "Select a Time" : "Confirm Booking"}
              </h2>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === "date" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                <Clock3 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-[#062e39]">{service.title}</h4>
                <p className="text-xs text-slate-500">{service.duration_minutes} min • Zoom Session</p>
              </div>
            </div>
            {renderCalendar()}
          </div>
        )}

        {step === "time" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#062e39]">
                {new Date(selectedDate!).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Available slots for this day</p>
            </div>
            <div className="grid gap-2">
              {selectedDay?.slots.map((slot) => (
                <button
                  key={slot.starts_at}
                  onClick={() => handleSlotSelect(slot)}
                  className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-[#fd5523] hover:bg-[#fff6ee] transition-all"
                >
                  <span className="font-bold text-[#062e39] group-hover:text-[#fd5523]">{slot.label}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 group-hover:bg-[#fd5523] group-hover:text-white transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking Summary</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#062e39]">
                      {new Date(selectedSlot!.starts_at).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-500">Scheduled Date</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#062e39]">{selectedSlot!.label}</p>
                    <p className="text-[10px] text-slate-500">{service.duration_minutes} Minute Session</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#062e39]">Zoom Meeting</p>
                    <p className="text-[10px] text-slate-500">Virtual Training</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notes for the instructor</label>
              <textarea
                name="learner_notes"
                rows={4}
                placeholder="What would you like to focus on during this session?"
                className="w-full rounded-xl border-2 border-slate-100 bg-white p-4 text-sm outline-none focus:border-[#fd5523] focus:ring-4 focus:ring-[#fd5523]/5 transition-all"
              />
            </div>

            <Button 
              type="submit" 
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-[#fd5523] text-white font-bold text-lg shadow-lg shadow-[#fd5523]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Booking Slot...
                </>
              ) : (
                <>
                  Confirm Booking
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center text-center py-10 animate-in zoom-in-95 duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-20" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-12 w-12" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-[#062e39]">Booking Requested!</h2>
            <p className="mt-4 max-w-xs text-slate-600 leading-relaxed">
              We've sent your request to the instructor. You'll receive a notification once the slot is confirmed.
            </p>

            <div className="mt-10 w-full rounded-[2rem] bg-slate-50 p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Session</span>
                <span className="font-bold text-[#062e39]">{service.title}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Time</span>
                <span className="font-bold text-[#062e39]">{selectedSlot?.label}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Date</span>
                <span className="font-bold text-[#062e39]">
                  {new Date(selectedSlot!.starts_at).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            <Button 
              className="mt-10 w-full h-12 rounded-xl bg-[#062e39] text-white font-bold"
              onClick={onClose}
            >
              Back to Lesson
            </Button>
          </div>
        )}
      </div>

      {/* Timezone Info */}
      {step !== "success" && (
        <div className="px-6 py-4 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <Info className="h-3 w-3" />
            Times are shown in {timezone.replace('_', ' ')}
          </div>
        </div>
      )}
    </div>
  );
}
