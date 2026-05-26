"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createModule, updateModule, deleteModule, reorderModules } from "@/actions/modules";
import { createLesson, reorderLessons, updateLesson, deleteLesson } from "@/actions/lessons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AIBlueprintAssistant } from "./ai-blueprint-assistant";
import { AICurriculumGenerator } from "./ai-curriculum-generator";

type LessonItem = { id: string; title: string; position: number; is_preview: boolean; content_block_count?: number };
type ModuleItem = { id: string; title: string; position: number; lessons: LessonItem[] };

function SortableLesson({
  lesson,
  courseId,
  onPreviewToggled,
  onDelete,
}: {
  lesson: LessonItem;
  courseId: string;
  onPreviewToggled: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const [pending, startTransition] = useTransition();

  function togglePreview() {
    const next = !lesson.is_preview;
    startTransition(async () => {
      try {
        await updateLesson(lesson.id, courseId, { is_preview: next });
        onPreviewToggled(lesson.id, next);
        toast.success(next ? "Lesson set to preview" : "Lesson set to draft");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update lesson.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLesson(lesson.id, courseId);
        onDelete(lesson.id);
        toast.success("Lesson deleted");
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        toast.error(err instanceof Error ? err.message : "Unable to delete lesson.");
      }
    });
  }

  const blockCount = lesson.content_block_count ?? 0;
  const contentStatus =
    blockCount === 0 ? { label: "Empty", classes: "bg-slate-100 text-slate-600" } :
    blockCount < 3 ? { label: "Started", classes: "bg-amber-100 text-amber-700" } :
    { label: "Built", classes: "bg-emerald-100 text-emerald-700" };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm transition-all hover:border-[#fd5523]/30 hover:shadow-md sm:gap-3 sm:rounded-2xl sm:p-4 ${
        isDragging ? "z-10 opacity-50 ring-2 ring-[#fd5523]" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab text-slate-400 hover:text-[#fd5523] active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff6ee] text-[#fd5523] sm:h-10 sm:w-10 sm:rounded-xl">
        <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>

      <Link
        href={`/creator/courses/${courseId}/lessons/${lesson.id}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-[#062e39] transition-colors hover:text-[#fd5523] sm:text-base"
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{lesson.title}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${contentStatus.classes}`}>
              {contentStatus.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {blockCount} block{blockCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex w-full flex-row items-center justify-between gap-2 pt-2 sm:w-auto sm:pt-0">
        <button
          onClick={togglePreview}
          disabled={pending}
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
            lesson.is_preview
              ? "bg-[#fd5523] text-white hover:bg-[#ef4a16]"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : lesson.is_preview ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> 
              <span className="hidden sm:inline">Preview</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> 
              <span className="hidden sm:inline">Draft</span>
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <Link
            href={`/creator/courses/${courseId}/lessons/${lesson.id}`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-[#062e39] hover:text-white sm:h-8 sm:w-8"
          >
            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 sm:h-8 sm:w-8"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableModule({
  mod,
  courseId,
  expanded,
  onExpandedChange,
  onRefresh,
}: {
  mod: ModuleItem;
  courseId: string;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  onRefresh: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessons, setLessons] = useState(mod.lessons);
  const [pending, startTransition] = useTransition();

  const lessonSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIndex, newIndex);
    setLessons(reordered);

    startTransition(async () => {
      try {
        await reorderLessons(mod.id, courseId, reordered.map((l) => l.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to reorder lessons.");
      }
    });
  }

  function handleSaveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === mod.title) {
      setEditing(false);
      setTitle(mod.title);
      return;
    }

    startTransition(async () => {
      try {
        await updateModule(mod.id, courseId, trimmed);
        setEditing(false);
        toast.success("Module renamed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to rename module.");
      }
    });
  }

  function handleDeleteModule() {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return;
    startTransition(async () => {
      try {
        await deleteModule(mod.id, courseId);
        toast.success("Module deleted");
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete module.");
      }
    });
  }

  function handleAddLesson() {
    if (!lessonTitle.trim()) return;
    startTransition(async () => {
      try {
        toast.success("Opening lesson editor…");
        await createLesson(mod.id, lessonTitle.trim());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to create lesson.");
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-[#fffaf6]/50 shadow-sm transition-all sm:rounded-[2rem] ${
        isDragging ? "z-20 opacity-50 ring-4 ring-[#fd5523]/20" : ""
      }`}
    >
      {/* Module header - stacked on mobile, row on larger screens */}
      <div className="flex flex-col gap-2 border-b border-slate-200/60 bg-white p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4 md:p-5">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab text-slate-400 hover:text-[#fd5523] active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <button
            onClick={() => onExpandedChange(!expanded)}
            className="text-[#062e39] transition-colors hover:text-[#fd5523]"
          >
            {expanded ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>

        <div className="flex-1">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              className="h-9 flex-1 border-[#fd5523]/20 bg-white text-base font-bold text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523] sm:h-10 sm:text-lg"
              autoFocus
            />
          ) : (
            <div
              className="flex flex-wrap items-center gap-2 sm:gap-3"
              onDoubleClick={() => setEditing(true)}
            >
              <span className="text-base font-bold text-[#062e39] sm:text-lg">{mod.title}</span>
              <Badge variant="outline" className="rounded-full border-[#062e39]/10 bg-slate-50 px-2 py-0 text-[10px] text-slate-500 sm:px-2.5 sm:text-xs">
                {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
          <button
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-[#062e39] hover:text-white sm:h-8 sm:w-8"
          >
            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button
            onClick={handleDeleteModule}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 sm:h-8 sm:w-8"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
          <DndContext sensors={lessonSensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
            <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lessons.map((lesson) => (
                <SortableLesson
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  onPreviewToggled={(lessonId, next) =>
                    setLessons((prev) =>
                      prev.map((l) => (l.id === lessonId ? { ...l, is_preview: next } : l))
                    )
                  }
                  onDelete={(lessonId) =>
                    setLessons((prev) => prev.filter((l) => l.id !== lessonId))
                  }
                />
              ))}
            </SortableContext>
          </DndContext>

          {addingLesson ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[#fd5523]/20 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:rounded-2xl sm:p-4">
              <Input
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Name your lesson..."
                className="h-10 flex-1 border-0 bg-transparent text-sm font-medium placeholder:text-slate-400 focus:ring-0 sm:text-base"
                onKeyDown={(e) => e.key === "Enter" && handleAddLesson()}
                autoFocus
                onBlur={() => {
                  if (!lessonTitle.trim()) setAddingLesson(false);
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-full bg-[#062e39] px-3 text-sm text-white hover:bg-[#0a4055] sm:px-4"
                  onClick={handleAddLesson}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full text-sm text-slate-700 hover:text-slate-900"
                  onClick={() => {
                    setAddingLesson(false);
                    setLessonTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingLesson(true)}
              className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition-all hover:border-[#fd5523]/40 hover:bg-[#fff6ee]/50 hover:text-[#fd5523] sm:rounded-2xl sm:py-4 sm:text-base"
            >
              <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90 sm:h-4 sm:w-4" /> 
              Add a new lesson
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CurriculumBuilder({
  courseId,
  initialModules,
}: {
  courseId: string;
  initialModules: ModuleItem[];
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [query, setQuery] = useState("");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialModules.map((m) => [m.id, true]))
  );
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const moduleCount = modules.length;
  const lessonCount = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const startedLessonCount = modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => (lesson.content_block_count ?? 0) > 0).length,
    0
  );
  const previewLessonCount = modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => lesson.is_preview).length,
    0
  );

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules
      .map((m) => ({
        ...m,
        lessons: m.lessons.filter((l) => l.title.toLowerCase().includes(q)),
      }))
      .filter((m) => m.title.toLowerCase().includes(q) || m.lessons.length > 0);
  }, [modules, query]);

  function handleModuleDragEnd(event: DragEndEvent) {
    if (query.trim()) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(modules, oldIndex, newIndex);
    setModules(reordered);

    startTransition(async () => {
      try {
        await reorderModules(courseId, reordered.map((m) => m.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to reorder modules.");
      }
    });
  }

  function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    startTransition(async () => {
      try {
        await createModule(courseId, newModuleTitle.trim());
        setNewModuleTitle("");
        setAddingModule(false);
        router.refresh();
        toast.success("Module added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to add module.");
      }
    });
  }

  function setAllExpanded(value: boolean) {
    setExpandedMap(Object.fromEntries(modules.map((m) => [m.id, value])));
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats bar - stacked on mobile, row on larger */}
      <div className="flex flex-col gap-3 rounded-2xl border-0 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-5">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#fd5523] sm:h-5 sm:w-5" />
            <span className="text-[#062e39]">
              <span className="text-base font-bold sm:text-lg">{moduleCount}</span>{" "}
              <span className="hidden sm:inline">Modules</span>
            </span>
          </div>
          <div className="h-5 w-px bg-[#062e39]/10" />
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#fd5523] sm:h-5 sm:w-5" />
            <span className="text-[#062e39]">
              <span className="text-base font-bold sm:text-lg">{lessonCount}</span>{" "}
              <span className="hidden sm:inline">Lessons</span>
            </span>
          </div>
          <div className="h-5 w-px bg-[#062e39]/10" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#fd5523] sm:h-5 sm:w-5" />
            <span className="text-[#062e39]">
              <span className="text-base font-bold sm:text-lg">{startedLessonCount}</span>{" "}
              <span className="hidden sm:inline">Started</span>
            </span>
          </div>
          <div className="h-5 w-px bg-[#062e39]/10" />
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#fd5523] sm:h-5 sm:w-5" />
            <span className="text-[#062e39]">
              <span className="text-base font-bold sm:text-lg">{previewLessonCount}</span>{" "}
              <span className="hidden sm:inline">Previews</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <AIBlueprintAssistant courseId={courseId} />
          <div className="h-5 w-px bg-[#062e39]/10" />
          <Button
            variant="ghost"
            className="h-8 rounded-full px-2 text-xs text-[#062e39] hover:bg-[#fff6ee] hover:text-[#fd5523] sm:h-9 sm:px-3 sm:text-sm"
            onClick={() => setAllExpanded(true)}
          >
            Expand all
          </Button>
          <Button
            variant="ghost"
            className="h-8 rounded-full px-2 text-xs text-[#062e39] hover:bg-[#fff6ee] hover:text-[#fd5523] sm:h-9 sm:px-3 sm:text-sm"
            onClick={() => setAllExpanded(false)}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <AICurriculumGenerator courseId={courseId} />

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter modules or lessons..."
          className="h-11 rounded-xl border-[#062e39]/10 bg-white pl-9 text-sm font-medium text-[#062e39] shadow-sm transition-all focus:border-[#fd5523] focus:ring-[#fd5523]/10 sm:h-14 sm:rounded-2xl sm:pl-12 sm:text-lg"
        />
      </div>

      {/* Modules list */}
      <div className="space-y-3 sm:space-y-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext items={filteredModules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {filteredModules.map((mod) => (
              <SortableModule
                key={mod.id}
                mod={mod}
                courseId={courseId}
                expanded={expandedMap[mod.id] ?? true}
                onExpandedChange={(next) => setExpandedMap((prev) => ({ ...prev, [mod.id]: next }))}
                onRefresh={() => router.refresh()}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add module button */}
      {addingModule ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#fd5523]/20 bg-white p-4 shadow-xl sm:flex-row sm:items-center sm:gap-4 sm:rounded-[2.5rem] sm:p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523] sm:h-12 sm:w-12 sm:rounded-2xl">
            <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="What's this module called?"
            className="h-10 flex-1 border-0 bg-transparent text-base font-bold placeholder:text-slate-300 focus:ring-0 sm:h-12 sm:text-xl"
            onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              className="h-9 rounded-full bg-[#fd5523] px-4 text-sm text-white hover:bg-[#ef4a16] sm:h-11 sm:px-8 sm:text-base"
              onClick={handleAddModule}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Module"}
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-full text-sm text-slate-500 sm:h-11 sm:text-base"
              onClick={() => {
                setAddingModule(false);
                setNewModuleTitle("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingModule(true)}
          className="group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-8 text-slate-500 transition-all hover:border-[#fd5523]/50 hover:bg-[#fff6ee]/20 hover:text-[#fd5523] sm:gap-4 sm:rounded-[3rem] sm:py-12"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm transition-all group-hover:bg-[#fd5523] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#fd5523]/30 sm:h-16 sm:w-16 sm:rounded-[2rem]">
            <Plus className="h-6 w-6 transition-transform group-hover:rotate-90 sm:h-8 sm:w-8" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold sm:text-lg">Add a new module</p>
            <p className="text-xs font-medium opacity-60 sm:text-sm">Organize your course into logical sections</p>
          </div>
        </button>
      )}
    </div>
  );
}
