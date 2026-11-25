"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  UsersRound,
  Plus,
  Trash2,
  Loader2,
  BookOpen,
  GraduationCap,
  Users,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getClassroomGroups,
  createClassroomGroup,
  updateClassroomGroup,
  deleteClassroomGroup,
  getCompanyCourses,
} from "@/actions/classroom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ManageGroupModal } from "./ManageGroupModal";
import { cn } from "@/lib/utils";
import { DEFAULT_PRIMARY_COLOR, BRAND_COLORS } from "@/lib/brand";

const COHORT_COLORS = [
  { name: "Royal Blue", hex: BRAND_COLORS.royalBlue },
  { name: "Orange", hex: BRAND_COLORS.orange },
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
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Controlled form state (Create & Edit)
  const [formName, setFormName] = useState("");
  const [formCourseId, setFormCourseId] = useState("all");
  const [formPeriod, setFormPeriod] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PRIMARY_COLOR);

  async function load() {
    try {
      const [groupsData, coursesData] = await Promise.all([
        getClassroomGroups(companyId),
        getCompanyCourses(companyId),
      ]);
      setGroups(groupsData || []);
      setCourses(coursesData || []);
    } catch {
      toast.error("Failed to load subjects & classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  function openCreateModal() {
    setEditingGroup(null);
    setFormName("");
    setFormCourseId("all");
    setFormPeriod("");
    setFormDescription("");
    setSelectedColor(DEFAULT_PRIMARY_COLOR);
    setOpen(true);
  }

  function openEditModal(group: any) {
    setEditingGroup(group);
    setFormName(group.name || "");
    setFormCourseId(group.course_id || group.course?.id || "all");
    setFormPeriod(group.academic_period || "");
    setFormDescription(group.description || "");
    setSelectedColor(group.color || DEFAULT_PRIMARY_COLOR);
    setOpen(true);
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    const formData = new FormData();
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);
    formData.append("name", formName.trim());
    formData.append("courseId", formCourseId || "all");
    formData.append("academicPeriod", formPeriod.trim());
    formData.append("description", formDescription.trim());
    formData.append("color", selectedColor);

    try {
      if (editingGroup) {
        await updateClassroomGroup(editingGroup.id, formData);
        toast.success("Class / Subject updated!");
      } else {
        await createClassroomGroup(formData);
        toast.success("Class / Subject created!");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save class");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(groupId: string, name: string) {
    if (!confirm(`Delete "${name}"? Enrolled students will remain in the academy.`)) return;
    try {
      await deleteClassroomGroup(groupId, companyId, companySlug);
      toast.success("Class / Subject deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  async function handleAssignCourseToClass(groupId: string, courseId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const formData = new FormData();
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);
    formData.append("name", group.name);
    formData.append("courseId", courseId || "all");
    formData.append("academicPeriod", group.academic_period || "");
    formData.append("description", group.description || "");
    formData.append("color", group.color || DEFAULT_PRIMARY_COLOR);
    try {
      await updateClassroomGroup(groupId, formData);
      toast.success("Course linked to class!");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update link");
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/40 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight truncate">
              Subjects, Classes &amp; Courses
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-black text-slate-500 shrink-0">
              {groups.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Organize learners into subjects or classes, link courses to each class, and scope materials &amp; assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/academy/${companySlug}/admin/courses/new`}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-ink hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5 text-brand-text" />
            <span>New Course</span>
          </Link>
          <Button
            type="button"
            onClick={openCreateModal}
            className="h-10 px-4 rounded-xl bg-brand text-white hover:bg-brand-hover text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Subject / Class</span>
          </Button>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-lg rounded-2xl sm:rounded-3xl border-slate-100 p-0 overflow-hidden max-h-[88dvh] flex flex-col">
          <div className="p-5 sm:p-6 bg-ink text-white shrink-0">
            <DialogHeader>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-electric">
                <GraduationCap className="h-4 w-4" /> Subject / Class Group
              </div>
              <DialogTitle className="text-lg sm:text-xl font-black text-white mt-1">
                {editingGroup ? `Edit "${editingGroup.name}"` : "Create Subject or Class Section"}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form onSubmit={handleSaveGroup} className="p-4 sm:p-6 space-y-4 bg-white flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Subject / Class Name <span className="text-brand-text">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Data Science · Term 1, Grade 10 Mathematics"
                className="h-11 rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Associated Course
                </label>
                <select
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-ink outline-none focus:border-brand"
                >
                  <option value="all">General / Cross-Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Academic Term / Intake
                </label>
                <Input
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
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
                      "h-8 w-8 rounded-xl transition-all",
                      selectedColor === c.hex ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Description / Outcomes
              </label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional details or syllabus goals for this subject/class..."
                className="rounded-xl text-xs resize-none h-20"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={saving || !formName.trim()}
                className="w-full h-11 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider shadow-sm"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {editingGroup ? "Save Changes" : "Create Subject / Class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subjects & Classes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-text mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading Classes &amp; Courses...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-14 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6">
          <div className="h-14 w-14 rounded-2xl bg-orange-50 text-brand-text flex items-center justify-center mx-auto mb-3">
            <UsersRound className="h-7 w-7" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-ink">No Subjects or Classes Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create classes or subjects and link them to your courses so students find their materials, assignments, and schedules in one place.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => {
            const brandColor = group.color || DEFAULT_PRIMARY_COLOR;
            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                      style={{ backgroundColor: brandColor }}
                    >
                      <UsersRound className="h-5 w-5" />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                        {group.academic_period || "Active"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(group)}
                        className="h-8 w-8 text-slate-400 hover:text-ink rounded-lg"
                        title="Edit Subject / Link Course"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                    {group.name}
                  </h3>

                  {group.course ? (
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg w-fit max-w-full">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{group.course.title}</span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleAssignCourseToClass(group.id, e.target.value);
                        }}
                        className="h-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-brand"
                      >
                        <option value="">+ Link a course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                    {group.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-brand-text" />
                    <span>{group.students_count || 0} Learners</span>
                  </span>

                  <ManageGroupModal group={group} companyId={companyId} companySlug={companySlug} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Courses Overview & Quick Class Link */}
      {courses.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-ink">
                Academy Courses ({courses.length})
              </h3>
              <p className="text-xs text-slate-500">
                Quickly open any course studio or review which class/subject it belongs to.
              </p>
            </div>
            <Link
              href={`/academy/${companySlug}/admin/courses`}
              className="text-xs font-bold text-brand-text hover:underline whitespace-nowrap"
            >
              Manage All →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {courses.map((course) => {
              const linkedClasses = groups.filter(
                (g) => g.course_id === course.id || g.course?.id === course.id
              );
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-ink truncate">{course.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {linkedClasses.length > 0
                        ? `Class: ${linkedClasses.map((g) => g.name).join(", ")}`
                        : "Not linked to a class yet"}
                    </p>
                  </div>
                  <Link
                    href={`/academy/${companySlug}/admin/courses/${course.id}`}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-ink hover:border-brand hover:text-brand-text inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Studio</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
