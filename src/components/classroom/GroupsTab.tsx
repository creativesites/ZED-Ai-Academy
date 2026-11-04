"use client";

import { useState, useEffect } from "react";
import {
  UsersRound,
  Plus,
  Trash2,
  Loader2,
  Info,
  BookOpen,
  Calendar,
  Sparkles,
  GraduationCap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getClassroomGroups,
  createClassroomGroup,
  deleteClassroomGroup,
  getCompanyCourses,
} from "@/actions/classroom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ManageGroupModal } from "./ManageGroupModal";
import { cn } from "@/lib/utils";

const COHORT_COLORS = [
  { name: "Orange", hex: "#fd5523" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Amber", hex: "#f59e0b" },
];

export function GroupsTab({ companyId, companySlug }: { companyId: string; companySlug: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#fd5523");

  async function load() {
    try {
      const [groupsData, coursesData] = await Promise.all([
        getClassroomGroups(companyId),
        getCompanyCourses(companyId),
      ]);
      setGroups(groupsData);
      setCourses(coursesData);
    } catch (e) {
      toast.error("Failed to load cohorts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  async function handleCreateGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);
    formData.append("color", selectedColor);

    try {
      await createClassroomGroup(formData);
      toast.success("Cohort created successfully!");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create cohort");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteGroup(groupId: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? Enrolled students will remain in the academy.`)) return;
    try {
      await deleteClassroomGroup(groupId, companyId, companySlug);
      toast.success("Cohort deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete cohort");
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/40 p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#062e39] tracking-tight">
              Class Cohorts &amp; Sections
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-black text-slate-500">
              {groups.length}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
            Organize students by intake period, link cohorts to courses, and scope schedules &amp; materials.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={(props) => (
            <Button
              {...props}
              className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-xl h-11 px-5 font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#fd5523]/20 flex items-center justify-center gap-2 w-full md:w-auto min-h-[44px]"
            >
              <Plus className="h-4 w-4" /> Create Cohort / Section
            </Button>
          )} />
          <DialogContent className="rounded-2xl sm:rounded-3xl border-slate-100 p-0 overflow-hidden w-[95vw] sm:max-w-lg max-h-[85dvh] flex flex-col">
            <div className="p-5 sm:p-6 bg-[#062e39] text-white shrink-0">
              <DialogHeader>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#fd8d69]">
                  <GraduationCap className="h-4 w-4" /> Academic Group
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-white mt-1">
                  Create Class Cohort
                </DialogTitle>
              </DialogHeader>
            </div>

            <form onSubmit={handleCreateGroup} className="p-4 sm:p-6 space-y-4 bg-white flex-1 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cohort Name
                </label>
                <Input
                  name="name"
                  required
                  placeholder="e.g. AI Fundamentals — January 2027 Cohort"
                  className="h-11 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Associated Course
                  </label>
                  <Select name="courseId" defaultValue="all">
                    <SelectTrigger className="h-11 rounded-xl text-xs">
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">General / Cross-Course</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Academic Term / Period
                  </label>
                  <Input
                    name="academicPeriod"
                    placeholder="e.g. Term 1, Jan 2027"
                    className="h-11 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Badge Color
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {COHORT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      className={cn(
                        "h-8 w-8 rounded-xl transition-all flex items-center justify-center",
                        selectedColor === c.hex ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description / Syllabus Goals
                </label>
                <Textarea
                  name="description"
                  placeholder="Optional details or target outcomes for this cohort..."
                  className="rounded-xl text-xs resize-none h-20"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full h-12 rounded-xl bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#fd5523]/20"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Save &amp; Initialize Cohort
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cohorts Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest">Loading Cohorts...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8">
            <div className="h-16 w-16 rounded-2xl bg-orange-50 text-[#fd5523] flex items-center justify-center mx-auto mb-4">
              <UsersRound className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-[#062e39]">No Cohorts Initialized Yet</h3>
            <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm mx-auto">
              Create student cohorts (e.g. "January 2027 Cohort") to organize timetables, course documents, and assignments.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {groups.map((group) => {
              const brandColor = group.color || "#fd5523";
              return (
                <div
                  key={group.id}
                  className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                        style={{ backgroundColor: brandColor }}
                      >
                        <UsersRound className="h-6 w-6" />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                          {group.academic_period || "Active Cohort"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors">
                      {group.name}
                    </h3>

                    {group.course && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-indigo-600 bg-indigo-50/60 border border-indigo-100/60 px-2.5 py-1 rounded-lg w-fit">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                        <span>{group.course.title}</span>
                      </div>
                    )}

                    <p className="text-xs font-medium text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                      {group.description || "No description provided for this cohort."}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-[#fd5523]" />
                      <span>{group.students_count || 0} Students Enrolled</span>
                    </span>

                    <ManageGroupModal group={group} companyId={companyId} companySlug={companySlug} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
