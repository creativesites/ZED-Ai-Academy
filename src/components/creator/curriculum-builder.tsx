"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { addLesson, deleteLesson, duplicateLesson, reorderLessons, updateLesson } from "@/actions/lessons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AIBlueprintAssistant } from "./ai-blueprint-assistant";
import { BulkLessonGenerator } from "./studio/bulk-lesson-generator";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";
import { getLessonEditorPath } from "@/lib/courses/course-routes";
import { cn } from "@/lib/utils";

type LessonItem = {
  id: string;
  title: string;
  position: number;
  is_preview: boolean;
  content_block_count?: number;
  has_quiz?: boolean;
};
type ModuleItem = { id: string; title: string; position: number; lessons: LessonItem[] };

const MENU_CLASS = "w-52 rounded-xl p-1.5";
const ITEM_CLASS = "gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium cursor-pointer";

function isRedirect(err: unknown) {
  return err instanceof Error && err.message.includes("NEXT_REDIRECT");
}

function LessonStatus({ lesson }: { lesson: LessonItem }) {
  const count = lesson.content_block_count ?? 0;
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Empty
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {count} block{count === 1 ? "" : "s"}
    </span>
  );
}

function SortableLesson({
  lesson,
  index,
  moduleIndex,
  isFirst,
  isLast,
  courseId,
  tenantSlug,
  dragDisabled,
  onChange,
  onRemove,
  onDuplicated,
  onMove,
}: {
  lesson: LessonItem;
  index: number;
  moduleIndex: number;
  isFirst: boolean;
  isLast: boolean;
  courseId: string;
  tenantSlug?: string;
  dragDisabled: boolean;
  onChange: (next: LessonItem) => void;
  onRemove: (id: string) => void;
  onDuplicated: (sourceId: string, copy: LessonItem) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    disabled: dragDisabled,
  });
  const [pending, startTransition] = useTransition();
  const href = getLessonEditorPath(courseId, lesson.id, tenantSlug);

  if (lesson.id.startsWith("temp-")) {
    return (
      <li ref={setNodeRef} className="flex items-center gap-3 rounded-xl py-2.5 pl-3 pr-3 opacity-70 sm:pl-6">
        <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
          {moduleIndex + 1}.{index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{lesson.title}</span>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
      </li>
    );
  }

  function togglePreview() {
    const next = !lesson.is_preview;
    startTransition(async () => {
      try {
        await updateLesson(lesson.id, courseId, { is_preview: next }, tenantSlug);
        onChange({ ...lesson, is_preview: next });
        toast.success(next ? "Anyone can now preview this lesson" : "Lesson is for enrolled learners only");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to update lesson.");
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const copy = await duplicateLesson(lesson.id, courseId, tenantSlug);
        onDuplicated(lesson.id, copy);
        toast.success("Lesson duplicated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to duplicate lesson.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete “${lesson.title}”? Its content and quiz will be removed.`)) return;
    startTransition(async () => {
      try {
        await deleteLesson(lesson.id, courseId, tenantSlug);
        onRemove(lesson.id);
        toast.success("Lesson deleted");
      } catch (err) {
        if (isRedirect(err)) {
          onRemove(lesson.id);
          return;
        }
        toast.error(err instanceof Error ? err.message : "Unable to delete lesson.");
      }
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex items-center gap-1 rounded-xl bg-white pr-1 transition-colors hover:bg-slate-50",
        isDragging && "z-10 shadow-lg ring-2 ring-brand/40",
        pending && "opacity-60"
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className={cn(
          "hidden h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing sm:flex",
          dragDisabled && "invisible"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 sm:pl-0">
        <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
          {moduleIndex + 1}.{index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink group-hover:text-brand-text">
            {lesson.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <LessonStatus lesson={lesson} />
            {lesson.has_quiz && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                <HelpCircle className="h-3 w-3" /> Quiz
              </span>
            )}
            {lesson.is_preview && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-text">
                <Eye className="h-3 w-3" /> Free preview
              </span>
            )}
          </span>
        </span>
      </Link>

      {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${lesson.title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-ink data-[popup-open]:bg-white data-[popup-open]:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CLASS}>
          <DropdownMenuItem className={ITEM_CLASS} render={<Link href={href} />}>
            <Pencil className="h-4 w-4" /> Edit lesson
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM_CLASS} onClick={togglePreview}>
            {lesson.is_preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {lesson.is_preview ? "Remove free preview" : "Make free preview"}
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM_CLASS} onClick={handleDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={ITEM_CLASS} disabled={isFirst || dragDisabled} onClick={() => onMove(lesson.id, -1)}>
            <ArrowUp className="h-4 w-4" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM_CLASS} disabled={isLast || dragDisabled} onClick={() => onMove(lesson.id, 1)}>
            <ArrowDown className="h-4 w-4" /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={ITEM_CLASS} variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function SortableModule({
  mod,
  index,
  total,
  courseId,
  tenantSlug,
  expanded,
  dragDisabled,
  onExpandedChange,
  onModuleChange,
  onModuleRemoved,
  onModuleMove,
}: {
  mod: ModuleItem;
  index: number;
  total: number;
  courseId: string;
  tenantSlug?: string;
  expanded: boolean;
  dragDisabled: boolean;
  onExpandedChange: (next: boolean) => void;
  onModuleChange: (updater: (m: ModuleItem) => ModuleItem) => void;
  onModuleRemoved: (id: string) => void;
  onModuleMove: (id: string, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
    disabled: dragDisabled,
  });
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const [adding, setAdding] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);

  const [syncedTitle, setSyncedTitle] = useState(mod.title);
  if (syncedTitle !== mod.title) {
    setSyncedTitle(mod.title);
    setTitle(mod.title);
  }

  const lessonSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function persistLessonOrder(lessons: LessonItem[]) {
    onModuleChange((m) => ({ ...m, lessons }));
    startTransition(async () => {
      try {
        await reorderLessons(mod.id, courseId, lessons.map((l) => l.id), tenantSlug);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to reorder lessons.");
        router.refresh();
      }
    });
  }

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = mod.lessons.findIndex((l) => l.id === active.id);
    const newIndex = mod.lessons.findIndex((l) => l.id === over.id);
    persistLessonOrder(arrayMove(mod.lessons, oldIndex, newIndex));
  }

  function moveLesson(id: string, dir: -1 | 1) {
    const from = mod.lessons.findIndex((l) => l.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= mod.lessons.length) return;
    persistLessonOrder(arrayMove(mod.lessons, from, to));
  }

  function saveTitle() {
    const trimmed = title.trim();
    setEditing(false);
    if (!trimmed || trimmed === mod.title) {
      setTitle(mod.title);
      return;
    }
    onModuleChange((m) => ({ ...m, title: trimmed }));
    startTransition(async () => {
      try {
        await updateModule(mod.id, courseId, trimmed, tenantSlug);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to rename module.");
        onModuleChange((m) => ({ ...m, title: mod.title }));
      }
    });
  }

  function handleDeleteModule() {
    const n = mod.lessons.length;
    if (!window.confirm(`Delete “${mod.title}”${n ? ` and its ${n} lesson${n === 1 ? "" : "s"}` : ""}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteModule(mod.id, courseId, tenantSlug);
        onModuleRemoved(mod.id);
        toast.success("Module deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete module.");
      }
    });
  }

  function handleAddLesson() {
    const clean = lessonTitle.trim();
    if (!clean) return;
    // Optimistic: clear the field immediately so creators can keep typing the next title.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLessonTitle("");
    addInputRef.current?.focus();
    onModuleChange((m) => ({
      ...m,
      lessons: [...m.lessons, { id: tempId, title: clean, position: m.lessons.length + 1, is_preview: false, content_block_count: 0 }],
    }));
    addLesson(mod.id, clean, tenantSlug)
      .then((created) =>
        onModuleChange((m) => ({
          ...m,
          lessons: m.lessons.map((l) => (l.id === tempId ? { ...created, content_block_count: 0, has_quiz: false } : l)),
        }))
      )
      .catch((err) => {
        onModuleChange((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== tempId) }));
        toast.error(err instanceof Error ? err.message : `Couldn't add “${clean}”.`);
      });
  }

  const emptyCount = mod.lessons.filter((l) => !l.content_block_count).length;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white transition-shadow",
        isDragging && "z-20 shadow-xl ring-2 ring-brand/30"
      )}
    >
      <div className="flex items-center gap-1 p-2 sm:gap-2 sm:p-3">
        <button
          type="button"
          aria-label="Drag to reorder module"
          {...attributes}
          {...listeners}
          className={cn(
            "hidden h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing sm:flex",
            dragDisabled && "invisible"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse module" : "Expand module"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitle(mod.title);
                  setEditing(false);
                }
              }}
              autoFocus
              maxLength={200}
              className="h-9 w-full rounded-lg border border-brand/40 bg-white px-2.5 text-[15px] font-semibold text-ink outline-none ring-4 ring-brand/10"
            />
          ) : (
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              onDoubleClick={() => setEditing(true)}
              className="block w-full min-w-0 text-left"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Module {index + 1}
              </span>
              <span className="block truncate text-[15px] font-semibold leading-snug text-ink">{mod.title}</span>
            </button>
          )}
        </div>

        <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
          {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
          {emptyCount > 0 && <span className="text-amber-600"> · {emptyCount} empty</span>}
        </span>

        {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${mod.title}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink data-[popup-open]:bg-slate-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CLASS}>
            <DropdownMenuItem className={ITEM_CLASS} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className={ITEM_CLASS}
              onClick={() => {
                onExpandedChange(true);
                setAdding(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add lesson
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM_CLASS} disabled={index === 0 || dragDisabled} onClick={() => onModuleMove(mod.id, -1)}>
              <ArrowUp className="h-4 w-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLASS} disabled={index === total - 1 || dragDisabled} onClick={() => onModuleMove(mod.id, 1)}>
              <ArrowDown className="h-4 w-4" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM_CLASS} variant="destructive" onClick={handleDeleteModule}>
              <Trash2 className="h-4 w-4" /> Delete module
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-1 pb-2 pt-1 sm:px-2">
          {mod.lessons.length > 0 && (
            <DndContext sensors={lessonSensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
              <SortableContext items={mod.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {mod.lessons.map((lesson, i) => (
                    <SortableLesson
                      key={lesson.id}
                      lesson={lesson}
                      index={i}
                      moduleIndex={index}
                      isFirst={i === 0}
                      isLast={i === mod.lessons.length - 1}
                      courseId={courseId}
                      tenantSlug={tenantSlug}
                      dragDisabled={dragDisabled}
                      onMove={moveLesson}
                      onChange={(next) =>
                        onModuleChange((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === next.id ? next : l)) }))
                      }
                      onRemove={(id) => onModuleChange((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== id) }))}
                      onDuplicated={(sourceId, copy) =>
                        onModuleChange((m) => {
                          const at = m.lessons.findIndex((l) => l.id === sourceId);
                          const next = [...m.lessons];
                          next.splice(at + 1, 0, copy);
                          return { ...m, lessons: next };
                        })
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {adding ? (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-brand/30 bg-surface p-1.5 pl-3">
              <Plus className="h-4 w-4 shrink-0 text-brand-text" />
              <input
                ref={addInputRef}
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Lesson title, then press Enter"
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLesson();
                  }
                  if (e.key === "Escape") {
                    setAdding(false);
                    setLessonTitle("");
                  }
                }}
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleAddLesson}
                disabled={!lessonTitle.trim()}
                className="h-9 shrink-0 rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setLessonTitle("");
                }}
                className="h-9 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-slate-500 hover:bg-white"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-1 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-brand-soft hover:text-brand-text"
            >
              <Plus className="h-4 w-4" />
              Add lesson
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
  tenantSlug,
  courseCategory,
}: {
  courseId: string;
  initialModules: ModuleItem[];
  tenantSlug?: string;
  courseCategory?: string | null;
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [query, setQuery] = useState("");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  // Keep local state in sync after server refreshes (AI scaffolding, module creation, …).
  const [syncedInitial, setSyncedInitial] = useState(initialModules);
  if (syncedInitial !== initialModules) {
    setSyncedInitial(initialModules);
    setModules(initialModules);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const lessonCount = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const builtCount = modules.reduce((sum, m) => sum + m.lessons.filter((l) => (l.content_block_count ?? 0) > 0).length, 0);
  const searching = query.trim().length > 0;
  const emptyLessons = modules.flatMap((m) =>
    m.lessons.filter((l) => !l.content_block_count).map((l) => ({ id: l.id, title: l.title }))
  );
  const defaultPreset: CourseDomainPresetId =
    COURSE_DOMAIN_PRESETS.find((p) => p.suggestedCategory === courseCategory)?.id ?? "ai-professional";

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules
      .map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.title.toLowerCase().includes(q)) }))
      .filter((m) => m.title.toLowerCase().includes(q) || m.lessons.length > 0);
  }, [modules, query]);

  function persistModuleOrder(next: ModuleItem[]) {
    setModules(next);
    startTransition(async () => {
      try {
        await reorderModules(courseId, next.map((m) => m.id), tenantSlug);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to reorder modules.");
        router.refresh();
      }
    });
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    if (searching) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    persistModuleOrder(arrayMove(modules, oldIndex, newIndex));
  }

  function moveModule(id: string, dir: -1 | 1) {
    const from = modules.findIndex((m) => m.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= modules.length) return;
    persistModuleOrder(arrayMove(modules, from, to));
  }

  function handleAddModule() {
    const clean = newModuleTitle.trim();
    if (!clean) return;
    startTransition(async () => {
      try {
        await createModule(courseId, clean, tenantSlug);
        setNewModuleTitle("");
        setAddingModule(false);
        router.refresh();
        toast.success("Module added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to add module.");
      }
    });
  }

  const addModuleForm = addingModule ? (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand/30 bg-white p-2.5">
      <input
        value={newModuleTitle}
        onChange={(e) => setNewModuleTitle(e.target.value)}
        placeholder="Module name, e.g. “Getting started”"
        maxLength={200}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAddModule();
          if (e.key === "Escape") setAddingModule(false);
        }}
        className="h-11 w-full min-w-0 rounded-xl bg-slate-50 px-3.5 text-[15px] font-medium text-ink outline-none ring-brand/20 placeholder:text-slate-400 focus:bg-white focus:ring-4"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddModule}
          disabled={pending || !newModuleTitle.trim()}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add module
        </button>
        <button
          type="button"
          onClick={() => {
            setAddingModule(false);
            setNewModuleTitle("");
          }}
          className="h-10 whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  if (modules.length === 0) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="bg-gradient-to-br from-ink to-[#0d4d5e] px-5 py-8 text-center text-white sm:px-10 sm:py-12">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Layers className="h-6 w-6 text-brand-electric" />
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Outline your course</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Courses are made of modules, and modules hold lessons. Let AI draft an outline from your course
              description, or start building it yourself.
            </p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            <div className="flex flex-col rounded-xl border border-brand/25 bg-surface p-4">
              <Sparkles className="mb-2 h-5 w-5 text-brand-text" />
              <p className="font-semibold text-ink">Draft with AI</p>
              <p className="mb-4 mt-1 flex-1 text-sm text-slate-500">
                Get a 4-module outline in seconds. Review, remove what you don&apos;t need, then apply.
              </p>
              <AIBlueprintAssistant
                courseId={courseId}
                triggerLabel="Generate outline"
                triggerClassName="h-10 w-full justify-center border-0 bg-brand text-sm text-white hover:bg-brand-hover"
              />
            </div>
            <div className="flex flex-col rounded-xl border border-slate-200 p-4">
              <Plus className="mb-2 h-5 w-5 text-ink" />
              <p className="font-semibold text-ink">Start from scratch</p>
              <p className="mb-4 mt-1 flex-1 text-sm text-slate-500">
                Add your first module and type lesson titles one after another.
              </p>
              {addingModule ? (
                addModuleForm
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingModule(true)}
                  className="h-10 w-full rounded-xl bg-ink text-sm font-semibold text-white hover:bg-ink-hover"
                >
                  Add first module
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-500">
          <span className="font-semibold text-ink">{modules.length}</span> module{modules.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-ink">{lessonCount}</span> lesson{lessonCount === 1 ? "" : "s"}
          {lessonCount > 0 && (
            <>
              {" "}· <span className={cn("font-semibold", builtCount === lessonCount ? "text-emerald-600" : "text-amber-600")}>{builtCount}/{lessonCount}</span> built
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            const anyCollapsed = modules.some((m) => expandedMap[m.id] === false);
            setExpandedMap(Object.fromEntries(modules.map((m) => [m.id, anyCollapsed])));
          }}
          className="h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-white"
        >
          {modules.some((m) => expandedMap[m.id] === false) ? "Expand all" : "Collapse all"}
        </button>
        <AIBlueprintAssistant courseId={courseId} triggerLabel="AI outline" />
      </div>

      <BulkLessonGenerator courseId={courseId} emptyLessons={emptyLessons} defaultPreset={defaultPreset} />

      {lessonCount > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a lesson…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-ink outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/40 focus:ring-4"
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={filteredModules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {filteredModules.map((mod) => {
              const realIndex = modules.findIndex((m) => m.id === mod.id);
              return (
                <SortableModule
                  key={mod.id}
                  mod={mod}
                  index={realIndex}
                  total={modules.length}
                  courseId={courseId}
                  tenantSlug={tenantSlug}
                  dragDisabled={searching}
                  expanded={searching || expandedMap[mod.id] !== false}
                  onExpandedChange={(next) => setExpandedMap((prev) => ({ ...prev, [mod.id]: next }))}
                  onModuleChange={(updater) => setModules((prev) => prev.map((m) => (m.id === mod.id ? updater(m) : m)))}
                  onModuleRemoved={(id) => setModules((prev) => prev.filter((m) => m.id !== id))}
                  onModuleMove={moveModule}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {searching && filteredModules.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No lessons match “{query}”.</p>
      )}

      {addModuleForm ?? (
        <button
          type="button"
          onClick={() => setAddingModule(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 transition-colors hover:border-brand/40 hover:bg-brand-soft/50 hover:text-brand-text"
        >
          <Plus className="h-4 w-4" />
          Add module
        </button>
      )}
    </div>
  );
}
