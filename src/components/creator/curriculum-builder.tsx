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
import { createLesson, reorderLessons, updateLesson } from "@/actions/lessons";
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

type LessonItem = { id: string; title: string; position: number; is_preview: boolean };
type ModuleItem = { id: string; title: string; position: number; lessons: LessonItem[] };

function SortableLesson({
  lesson,
  courseId,
  onPreviewToggled,
}: {
  lesson: LessonItem;
  courseId: string;
  onPreviewToggled: (lessonId: string, next: boolean) => void;
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
        toast.success(next ? "Lesson set as preview" : "Lesson removed from preview");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update lesson preview setting.");
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm transition-all hover:border-[#fd5523]/30 hover:shadow-md ${
        isDragging ? "z-10 opacity-50 ring-2 ring-[#fd5523]" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab text-slate-400 hover:text-[#fd5523] active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
        <FileText className="h-5 w-5" />
      </div>

      <Link
        href={`/creator/courses/${courseId}/lessons/${lesson.id}`}
        className="flex-1 truncate text-base font-medium text-[#062e39] transition-colors hover:text-[#fd5523]"
      >
        {lesson.title}
      </Link>

      <button
        onClick={togglePreview}
        disabled={pending}
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          lesson.is_preview
            ? "bg-[#fd5523] text-white hover:bg-[#ef4a16]"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
        }`}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : lesson.is_preview ? (
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3 w-3" /> Preview
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="h-3 w-3" /> Draft
          </span>
        )}
      </button>

      <Link
        href={`/creator/courses/${courseId}/lessons/${lesson.id}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-[#062e39] hover:text-white lg:opacity-0 lg:group-hover:opacity-100"
      >
        <Pencil className="h-4 w-4" />
      </Link>
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
      className={`overflow-hidden rounded-[2.5rem] border border-slate-200 bg-[#fffaf6]/50 shadow-sm transition-all ${
        isDragging ? "z-20 opacity-50 ring-4 ring-[#fd5523]/20" : ""
      }`}
    >
      <div className="group flex items-center gap-3 border-b border-slate-200/60 bg-white px-5 py-4">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab text-slate-400 hover:text-[#fd5523] active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <button onClick={() => onExpandedChange(!expanded)} className="text-[#062e39] transition-colors hover:text-[#fd5523]">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>

        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
            className="h-10 flex-1 border-[#fd5523]/20 bg-white text-lg font-bold text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]"
            autoFocus
          />
        ) : (
          <div className="flex flex-1 items-center gap-3" onDoubleClick={() => setEditing(true)}>
            <span className="text-lg font-bold text-[#062e39]">{mod.title}</span>
            <Badge variant="outline" className="rounded-full border-[#062e39]/10 bg-slate-50 text-slate-500">
              {lessons.length} Lesson{lessons.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-2 opacity-0 transition-all group-hover:opacity-100">
          <button onClick={() => setEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-[#062e39] hover:text-white">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={handleDeleteModule} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 p-4">
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
                />
              ))}
            </SortableContext>
          </DndContext>

          {addingLesson ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#fd5523]/20 bg-white p-3 shadow-sm">
              <Input
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Name your lesson..."
                className="h-10 flex-1 border-0 bg-transparent text-base font-medium placeholder:text-slate-400 focus:ring-0"
                onKeyDown={(e) => e.key === "Enter" && handleAddLesson()}
                autoFocus
                onBlur={() => {
                  if (!lessonTitle.trim()) setAddingLesson(false);
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full bg-[#062e39] px-4 text-white hover:bg-[#0a4055]"
                  onClick={handleAddLesson}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-slate-700 hover:text-slate-900"
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
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-4 text-sm font-semibold text-slate-600 transition-all hover:border-[#fd5523]/40 hover:bg-[#fff6ee]/50 hover:text-[#fd5523]"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> 
              Add a new lesson to this module
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
    <div className="space-y-6">
      <div className="marketing-outline-card flex flex-wrap items-center justify-between gap-4 rounded-3xl border-0 p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#fd5523]" />
            <span className="text-[#062e39]">
              <span className="text-lg font-bold">{moduleCount}</span> Modules
            </span>
          </div>
          <div className="h-6 w-px bg-[#062e39]/10" />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#fd5523]" />
            <span className="text-[#062e39]">
              <span className="text-lg font-bold">{lessonCount}</span> Lessons
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            className="rounded-full text-[#062e39] hover:bg-[#fff6ee] hover:text-[#fd5523]" 
            size="sm" 
            onClick={() => setAllExpanded(true)}
          >
            Expand all
          </Button>
          <Button 
            variant="ghost" 
            className="rounded-full text-[#062e39] hover:bg-[#fff6ee] hover:text-[#fd5523]" 
            size="sm" 
            onClick={() => setAllExpanded(false)}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter modules or lessons..."
          className="h-14 rounded-2xl border-[#062e39]/10 bg-white pl-12 text-lg font-medium text-[#062e39] shadow-sm transition-all focus:border-[#fd5523] focus:ring-[#fd5523]/10"
        />
      </div>

      <div className="space-y-4">
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

      {addingModule ? (
        <div className="marketing-outline-card flex flex-wrap items-center gap-4 rounded-[2.5rem] border-2 border-[#fd5523]/20 bg-white p-6 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
            <Layers className="h-6 w-6" />
          </div>
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="What's this module called?"
            className="h-12 flex-1 border-0 bg-transparent text-xl font-bold placeholder:text-slate-300 focus:ring-0"
            onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button className="rounded-full bg-[#fd5523] px-8 text-white hover:bg-[#ef4a16]" onClick={handleAddModule} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Module"}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-slate-500"
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
          className="group flex w-full flex-col items-center justify-center gap-4 rounded-[3rem] border-2 border-dashed border-slate-200 bg-white/40 py-12 text-slate-500 transition-all hover:border-[#fd5523]/50 hover:bg-[#fff6ee]/20 hover:text-[#fd5523]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-white text-slate-300 shadow-sm transition-all group-hover:bg-[#fd5523] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#fd5523]/30">
            <Plus className="h-8 w-8 transition-transform group-hover:rotate-90" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">Add a new module</p>
            <p className="text-sm font-medium opacity-60">Organize your course into logical sections</p>
          </div>
        </button>
      )}
    </div>
  );
}
