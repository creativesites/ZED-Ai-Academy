"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
import {
  createContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
} from "@/actions/content-blocks";
import { updateLesson } from "@/actions/lessons";
import { VideoBlockEditor } from "@/components/creator/blocks/video-block";
import { TextBlockEditor } from "@/components/creator/blocks/text-block";
import { ImageBlockEditor } from "@/components/creator/blocks/image-block";
import { CalloutBlockEditor } from "@/components/creator/blocks/callout-block";
import { ToolSpotlightEditor } from "@/components/creator/blocks/tool-spotlight-block";
import { BeforeAfterEditor } from "@/components/creator/blocks/before-after-block";
import { ResourceBlockEditor } from "@/components/creator/blocks/resource-block";
import { AiPromptBlockEditor } from "@/components/creator/blocks/ai-prompt-block";
import { StepsBlockEditor } from "@/components/creator/blocks/steps-block";
import { ChecklistBlockEditor } from "@/components/creator/blocks/checklist-block";
import { KeyTakeawayBlockEditor } from "@/components/creator/blocks/key-takeaway-block";
import { ExpertNoteBlockEditor } from "@/components/creator/blocks/expert-note-block";
import { ComparisonTableEditor } from "@/components/creator/blocks/comparison-table-block";
import { CaseStudyBlockEditor } from "@/components/creator/blocks/case-study-block";
import { MeetingBlockEditor } from "@/components/creator/blocks/meeting-block";
import { PracticeExerciseBlockEditor } from "@/components/creator/blocks/practice-exercise-block";
import { QuizBuilder } from "@/components/creator/quiz-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Trash2,
  Video,
  Type,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  Save,
  HelpCircle,
  ImageIcon,
  Megaphone,
  Wrench,
  SplitSquareHorizontal,
  FileText,
  Plus,
  Pencil,
  Sparkles,
  ListOrdered,
  CheckSquare,
  Zap,
  Table,
  BookOpen,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ContentBlockType, Json } from "@/types/database";

type Block = {
  id: string;
  type: ContentBlockType;
  position: number;
  content: Json;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string | null;
  position: number;
};

type Quiz = {
  id: string;
  title: string | null;
  pass_threshold: number;
  max_attempts: number;
  quiz_questions: QuizQuestion[];
};

const BLOCK_META: Record<ContentBlockType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  video:          { label: "Video",          icon: Video,                  color: "text-red-500",     bgColor: "bg-red-50" },
  text:           { label: "Rich Text",      icon: Type,                   color: "text-[#fd5523]",   bgColor: "bg-[#fff6ee]" },
  image:          { label: "Visual",         icon: ImageIcon,              color: "text-violet-500",  bgColor: "bg-violet-50" },
  callout:        { label: "Pro Tip",        icon: Megaphone,              color: "text-amber-500",   bgColor: "bg-amber-50" },
  tool_spotlight: { label: "AI Tool",        icon: Wrench,                 color: "text-teal-500",    bgColor: "bg-teal-50" },
  before_after:   { label: "Comparison",     icon: SplitSquareHorizontal,  color: "text-pink-500",    bgColor: "bg-pink-50" },
  resource:       { label: "Asset",          icon: FileText,               color: "text-blue-600",    bgColor: "bg-blue-50" },
  quiz:           { label: "Check",          icon: HelpCircle,             color: "text-[#062e39]",   bgColor: "bg-slate-100" },
  ai_prompt:      { label: "AI Prompt",      icon: Sparkles,               color: "text-[#fd5523]",   bgColor: "bg-[#fff6ee]" },
  steps:          { label: "Steps",          icon: ListOrdered,            color: "text-indigo-600",  bgColor: "bg-indigo-50" },
  checklist:      { label: "Checklist",      icon: CheckSquare,            color: "text-emerald-600", bgColor: "bg-emerald-50" },
  key_takeaway:   { label: "Takeaways",      icon: Zap,                    color: "text-amber-600",   bgColor: "bg-amber-50" },
  practice_exercise: { label: "Practice",    icon: CheckSquare,            color: "text-emerald-700", bgColor: "bg-emerald-50" },
  expert_note:    { label: "Expert Note",    icon: Zap,                    color: "text-slate-100",   bgColor: "bg-slate-900" },
  comparison_table: { label: "Comparison",   icon: Table,                  color: "text-violet-600",  bgColor: "bg-violet-50" },
  case_study:     { label: "Case Study",     icon: BookOpen,               color: "text-indigo-600",  bgColor: "bg-indigo-50" },
  meeting:        { label: "Meeting",        icon: Video,                  color: "text-[#fd5523]",   bgColor: "bg-[#fff6ee]" },
};

const TOOLBAR_GROUPS: { heading: string; types: ContentBlockType[] }[] = [
  { heading: "Media & Visuals", types: ["video", "image", "before_after"] },
  { heading: "Knowledge Delivery", types: ["text", "callout", "tool_spotlight", "resource"] },
  { heading: "Practical Learning", types: ["ai_prompt", "steps", "checklist", "key_takeaway", "practice_exercise"] },
  { heading: "Advanced Learning", types: ["expert_note", "comparison_table", "case_study"] },
  { heading: "Live & Assessment", types: ["meeting", "quiz"] },
];

const DEFAULT_CONTENT: Record<ContentBlockType, Json> = {
  video:          { youtube_id: "", title: "" } as Json,
  text:           { html: "" } as Json,
  image:          { url: "", caption: "", alt: "", display: "contained" } as Json,
  callout:        { variant: "tip", title: "", body: "" } as Json,
  tool_spotlight: { name: "", description: "", url: "", icon_url: "" } as Json,
  before_after:   { before_url: "", after_url: "", caption: "" } as Json,
  resource:       { file_url: "", file_name: "", file_size: 0 } as Json,
  quiz:           { quiz_id: "" } as Json,
  ai_prompt:      { prompt: "", tool: "", label: "Try This Prompt" } as Json,
  steps:          { title: "", steps: [{ title: "", body: "" }] } as Json,
  checklist:      { title: "", items: [""] } as Json,
  key_takeaway:   { title: "Key Takeaways", points: [""] } as Json,
  practice_exercise: {
    title: "Practice Exercise",
    brief: "",
    mode: "text_response",
    estimated_minutes: 20,
    instructions: [""],
    deliverables: [{ type: "text", label: "Response", required: true }],
    allowed_file_types: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"],
    max_files: 5,
    rubric: [],
    ai_scoring_enabled: true,
    instructor_review_required: false,
    resubmissions_allowed: true,
  } as Json,
  expert_note:    { title: "Advanced Technical Deep Dive", body: "" } as Json,
  comparison_table: { headers: ["Feature", "Standard", "AI-Powered"], rows: [["Speed", "Slow", "Instant"]] } as Json,
  case_study:     { title: "New Case Study", context: "", action: "", result: "" } as Json,
  meeting:        { meeting_id: "", title: "Live Session", start_time: "" } as Json,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asTyped = <T,>(v: unknown): T => v as T;

function BlockEditor({
  block,
  courseId,
  courseTitle,
  moduleTitle,
  quiz,
  onChange,
}: {
  block: Block;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  quiz?: Quiz | null;
  onChange: (content: Json) => void;
}) {
  const c = block.content as unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit = (v: unknown) => onChange(v as any);

  if (block.type === "video")
    return <VideoBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "text")
    return <TextBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "image")
    return <ImageBlockEditor content={asTyped(c)} courseId={courseId} courseTitle={courseTitle} moduleTitle={moduleTitle} lessonTitle={block.id} onChange={emit} />;
  if (block.type === "callout")
    return <CalloutBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "tool_spotlight")
    return <ToolSpotlightEditor content={asTyped(c)} courseId={courseId} courseTitle={courseTitle} moduleTitle={moduleTitle} lessonTitle={block.id} onChange={emit} />;
  if (block.type === "before_after")
    return <BeforeAfterEditor content={asTyped(c)} courseId={courseId} courseTitle={courseTitle} moduleTitle={moduleTitle} lessonTitle={block.id} onChange={emit} />;
  if (block.type === "resource")
    return <ResourceBlockEditor content={asTyped(c)} courseId={courseId} onChange={emit} />;
  if (block.type === "ai_prompt")
    return <AiPromptBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "steps")
    return <StepsBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "checklist")
    return <ChecklistBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "key_takeaway")
    return <KeyTakeawayBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "expert_note")
    return <ExpertNoteBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "comparison_table")
    return <ComparisonTableEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "case_study")
    return <CaseStudyBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "meeting")
    return <MeetingBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "practice_exercise")
    return <PracticeExerciseBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "quiz")
    return <QuizBuilder lessonId={block.id} courseId={courseId} initialQuiz={quiz ?? null} initialQuestions={quiz?.quiz_questions ?? []} />;

  return <p className="text-sm text-slate-500">Block type &quot;{block.type}&quot; editor coming soon.</p>;
}

function SortableBlock({
  block,
  lessonId,
  courseId,
  courseTitle,
  moduleTitle,
  quiz,
  onDelete,
  onSave,
}: {
  block: Block;
  lessonId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  quiz?: Quiz | null;
  onDelete: (id: string) => void;
  onSave: (id: string, content: Json) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [content, setContent] = useState(block.content as Record<string, unknown>);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  const meta = BLOCK_META[block.type] ?? { label: block.type, icon: FileText, color: "text-slate-500", bgColor: "bg-slate-50" };
  const Icon = meta.icon;

  function handleSave() {
    startSave(async () => {
      await updateContentBlock(block.id, lessonId, courseId, content as Json);
      onSave(block.id, content as Json);
      toast.success("Block saved");
    });
  }

  function handleDelete() {
    if (!confirm("Delete this block?")) return;
    startDelete(async () => {
      await deleteContentBlock(block.id, lessonId, courseId);
      onDelete(block.id);
      toast.success("Block deleted");
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group overflow-hidden rounded-[2rem] border-2 transition-all ${
        isDragging 
          ? "opacity-50 shadow-2xl z-20 border-[#fd5523]" 
          : "border-slate-100 bg-white hover:border-[#fd5523]/20 hover:shadow-xl hover:shadow-[#062e39]/5"
      }`}
    >
      <div className="flex items-center gap-4 border-b border-slate-50 bg-[#fffaf6]/30 px-5 py-4">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-slate-400 transition-colors hover:text-[#fd5523]">
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.bgColor} ${meta.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-[#062e39]">{meta.label}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="rounded-full bg-[#fd5523] px-4 font-bold text-white hover:bg-[#ef4a16]"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-6">
          <BlockEditor
            block={{ ...block, content: content as Json }}
            courseId={courseId}
            courseTitle={courseTitle}
            moduleTitle={moduleTitle}
            quiz={quiz}
            onChange={(c) => setContent(c as Record<string, unknown>)}
          />
        </div>
      )}
    </div>
  );
}

export function LessonEditorClient({
  lesson,
  courseId,
  courseTitle,
  moduleTitle,
  initialBlocks,
  quiz,
}: {
  lesson: { id: string; title: string; is_preview: boolean };
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  initialBlocks: Block[];
  quiz?: Quiz | null;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [title, setTitle] = useState(lesson.title);
  const [isPreview, setIsPreview] = useState(lesson.is_preview);
  const [savingMeta, startSaveMeta] = useTransition();
  const [adding, startAdd] = useTransition();
  const [, startReorder] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSaveMeta() {
    startSaveMeta(async () => {
      await updateLesson(lesson.id, courseId, { title, is_preview: isPreview });
      toast.success("Lesson saved");
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered);
    startReorder(async () => {
      await reorderContentBlocks(lesson.id, courseId, reordered.map((b) => b.id));
    });
  }

  function addBlock(type: ContentBlockType) {
    startAdd(async () => {
      await createContentBlock(lesson.id, courseId, type, DEFAULT_CONTENT[type]);
      toast.success(`${BLOCK_META[type]?.label ?? type} block added`);
      window.location.reload();
    });
  }

  const hasQuiz = blocks.some((b) => b.type === "quiz");

  return (
    <div className="space-y-10">
      {/* Studio Toolbar / Meta */}
      <section className="marketing-shell mesh-orange noise overflow-hidden rounded-[2.5rem] border-0 p-8 shadow-2xl">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white text-[#fd5523] shadow-lg">
              <Pencil className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">Lesson Studio</p>
              <h1 className="text-3xl font-bold text-white tracking-tight">{title || "Untitled Lesson"}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your lesson a powerful title..."
              className="h-14 flex-1 rounded-2xl border-white/10 bg-white/10 text-xl font-bold text-white placeholder:text-white/30 focus:border-[#fd8d69] focus:ring-[#fd8d69]/10"
            />
            
            <label className="flex h-14 cursor-pointer select-none items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold text-white transition-all hover:bg-white/10">
              <input
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="h-5 w-5 rounded-lg border-white/20 bg-transparent text-[#fd5523] accent-[#fd5523] focus:ring-0"
              />
              <Eye className="h-5 w-5 opacity-60" />
              FREE PREVIEW
            </label>

            <Button onClick={handleSaveMeta} disabled={savingMeta} className="h-14 rounded-2xl bg-white px-10 text-lg font-bold text-[#062e39] shadow-xl transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95">
              {savingMeta ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Commit Changes
            </Button>
          </div>
        </div>
      </section>

      {/* Editor Main Surface */}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-[#062e39]">Content Stack</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{blocks.length} Blocks</p>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    lessonId={lesson.id}
                    courseId={courseId}
                    courseTitle={courseTitle}
                    moduleTitle={moduleTitle}
                    quiz={block.type === "quiz" ? quiz : null}
                    onDelete={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
                    onSave={(id, content) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>

          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 py-32 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-[#fff6ee] text-[#fd5523]">
                <Plus className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-[#062e39]">Empty Lesson Canvas</h3>
              <p className="mx-auto mt-2 max-w-sm text-slate-500">
                Start building your lesson by adding blocks from the library on the right.
              </p>
            </div>
          )}
        </div>

        {/* Studio Sidebar / Library */}
        <aside className="space-y-6">
          <div className="sticky top-8 space-y-6">
            <div className="marketing-card rounded-[2.5rem] border-0 p-6 shadow-xl">
              <div className="mb-6 flex items-center gap-2 text-[#062e39]">
                <Plus className="h-5 w-5 text-[#fd5523]" />
                <h3 className="font-bold uppercase tracking-widest">Block Library</h3>
              </div>
              
              <div className="space-y-8">
                {TOOLBAR_GROUPS.map((group) => (
                  <div key={group.heading}>
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{group.heading}</p>
                    <div className="grid gap-2">
                      {group.types
                        .filter((type) => type !== "quiz" || !hasQuiz)
                        .map((type) => {
                          const m = BLOCK_META[type];
                          const Icon = m.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addBlock(type)}
                              disabled={adding}
                              className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-all hover:border-[#fd5523]/30 hover:bg-[#fff6ee]/20 hover:shadow-md"
                            >
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${m.bgColor} ${m.color}`}>
                                {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                              </div>
                              <span className="text-sm font-bold text-[#062e39]">{m.label}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="marketing-outline-card rounded-[2rem] border-0 bg-slate-50/50 p-6">
              <div className="flex items-center gap-2 text-[#062e39]">
                <Sparkles className="h-4 w-4 text-[#fd5523]" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Studio Tip</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Mix media types to keep learners engaged. Use Callouts for &quot;Quick Wins&quot; and Tool Spotlights for practical ROI.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
