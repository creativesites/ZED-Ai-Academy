"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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
import { LearningObjectivesBlockEditor } from "@/components/creator/blocks/learning-objectives-block";
import { GlossaryBlockEditor } from "@/components/creator/blocks/glossary-block";
import { DiscussionPromptBlockEditor } from "@/components/creator/blocks/discussion-prompt-block";
import { AssignmentBlockEditor } from "@/components/creator/blocks/assignment-block";
import { RiskAssessmentBlockEditor } from "@/components/creator/blocks/risk-assessment-block";
import { TutorSessionBlockEditor } from "@/components/creator/blocks/tutor-session-block";
import { QuizBuilder } from "@/components/creator/quiz-builder";
import { AILessonGenerator } from "@/components/creator/ai-lesson-generator";
import { LessonPreviewPane } from "@/components/creator/lesson-preview-pane";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookMarked,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  GripVertical,
  HelpCircle,
  ImageIcon,
  ListOrdered,
  Loader2,
  Megaphone,
  MessagesSquare,
  Mic,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  SplitSquareHorizontal,
  Table,
  Target,
  Trash2,
  Type,
  Video,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

type SaveState = "saved" | "dirty" | "saving" | "error";

type BlockMeta = {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
};

const BLOCK_META: Record<ContentBlockType, BlockMeta> = {
  text:           { label: "Text",            description: "Headings, paragraphs, lists and links", icon: Type, color: "text-[#fd5523]", bgColor: "bg-[#fff6ee]" },
  video:          { label: "Video",           description: "Embed a YouTube video", icon: Video, color: "text-red-500", bgColor: "bg-red-50" },
  image:          { label: "Image",           description: "Upload or generate a visual", icon: ImageIcon, color: "text-violet-500", bgColor: "bg-violet-50" },
  before_after:   { label: "Before / After",  description: "Two images side by side", icon: SplitSquareHorizontal, color: "text-pink-500", bgColor: "bg-pink-50" },
  callout:        { label: "Callout",         description: "Tip, warning or note box", icon: Megaphone, color: "text-amber-500", bgColor: "bg-amber-50" },
  tool_spotlight: { label: "Tool Spotlight",  description: "Feature a tool with a link", icon: Wrench, color: "text-teal-500", bgColor: "bg-teal-50" },
  resource:       { label: "File / Resource", description: "Downloadable worksheet or PDF", icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50" },
  quiz:           { label: "Quiz",            description: "Scored knowledge check", icon: HelpCircle, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  ai_prompt:      { label: "Prompt",          description: "Copy-ready prompt for learners", icon: Sparkles, color: "text-[#fd5523]", bgColor: "bg-[#fff6ee]" },
  steps:          { label: "Steps",           description: "Numbered how-to walkthrough", icon: ListOrdered, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  checklist:      { label: "Checklist",       description: "Tickable list for learners", icon: CheckSquare, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  key_takeaway:   { label: "Key Takeaways",   description: "Summary of the main points", icon: Zap, color: "text-amber-600", bgColor: "bg-amber-50" },
  practice_exercise: { label: "Practice Exercise", description: "Hands-on task with AI feedback", icon: CheckSquare, color: "text-emerald-700", bgColor: "bg-emerald-50" },
  expert_note:    { label: "Expert Note",     description: "Advanced deep-dive aside", icon: Zap, color: "text-slate-100", bgColor: "bg-slate-800" },
  comparison_table: { label: "Table",         description: "Compare options in a grid", icon: Table, color: "text-violet-600", bgColor: "bg-violet-50" },
  case_study:     { label: "Case Study",      description: "Context, action, result", icon: BookOpen, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  meeting:        { label: "Live Session",    description: "Link a scheduled live class", icon: Video, color: "text-[#fd5523]", bgColor: "bg-[#fff6ee]" },
  learning_objectives: { label: "Objectives", description: "What learners will be able to do", icon: Target, color: "text-sky-600", bgColor: "bg-sky-50" },
  glossary:       { label: "Glossary",        description: "Key terms and definitions", icon: BookMarked, color: "text-violet-600", bgColor: "bg-violet-50" },
  discussion_prompt: { label: "Discussion",   description: "Question for the class to discuss", icon: MessagesSquare, color: "text-sky-700", bgColor: "bg-sky-50" },
  assignment:     { label: "Assignment",      description: "Deliverable with assessment notes", icon: ClipboardCheck, color: "text-emerald-700", bgColor: "bg-emerald-50" },
  risk_assessment:{ label: "Risk Assessment", description: "Hazards, risk level, controls", icon: ShieldAlert, color: "text-red-600", bgColor: "bg-red-50" },
  tutor_session:  { label: "Speaking Practice", description: "AI teacher role-play scene", icon: Mic, color: "text-cyan-700", bgColor: "bg-cyan-50" },
};

const TOOLBAR_GROUPS: { heading: string; types: ContentBlockType[] }[] = [
  { heading: "Essentials", types: ["text", "video", "image", "quiz", "callout", "resource"] },
  { heading: "Teach", types: ["learning_objectives", "steps", "key_takeaway", "glossary", "case_study", "comparison_table", "before_after", "expert_note", "tool_spotlight", "ai_prompt"] },
  { heading: "Practice", types: ["practice_exercise", "assignment", "checklist", "discussion_prompt", "tutor_session"] },
  { heading: "Live & Safety", types: ["meeting", "risk_assessment"] },
];

const QUICK_ADD: ContentBlockType[] = ["text", "video", "image", "quiz"];

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
  learning_objectives: { title: "Learning Objectives", objectives: [""] } as Json,
  glossary:       { title: "Glossary", terms: [{ term: "", definition: "" }] } as Json,
  discussion_prompt: { title: "Discussion Prompt", prompt: "", guidance: [""], mode: "group" } as Json,
  assignment:     { title: "Assignment", summary: "", deliverables: [""], assessment: "", estimated_minutes: 30 } as Json,
  risk_assessment:{ title: "Risk Assessment", rows: [{ hazard: "", risk: "Medium", control: "" }] } as Json,
  tutor_session:  { scenarioId: "", style: "scene", required: false, title: "", intro: "" } as Json,
};


// Helper
const asTyped = <T,>(v: unknown): T => v as T;

// --- Block Editor component (unchanged but responsive) ---
function BlockEditor({
  block,
  lessonId,
  courseId,
  courseTitle,
  moduleTitle,
  quiz,
  onChange,
}: {
  block: Block;
  lessonId: string;
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
    return <PracticeExerciseBlockEditor content={asTyped(c)} lessonId={lessonId} courseId={courseId} onChange={emit} />;
  if (block.type === "learning_objectives")
    return <LearningObjectivesBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "glossary")
    return <GlossaryBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "discussion_prompt")
    return <DiscussionPromptBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "assignment")
    return <AssignmentBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "risk_assessment")
    return <RiskAssessmentBlockEditor content={asTyped(c)} onChange={emit} />;
  if (block.type === "tutor_session")
    return <TutorSessionBlockEditor content={asTyped(c)} courseId={courseId} lessonId={lessonId} onChange={emit} />;
  if (block.type === "quiz")
    return <QuizBuilder lessonId={lessonId} courseId={courseId} initialQuiz={quiz ?? null} initialQuestions={quiz?.quiz_questions ?? []} />;

  return <p className="text-sm text-slate-500">Block type &quot;{block.type}&quot; editor coming soon.</p>;
}


const MENU_CLASS = "w-52 rounded-xl p-1.5";
const ITEM_CLASS = "gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium cursor-pointer";
const AUTOSAVE_MS = 1200;

// ─── Block card with autosave ────────────────────────────────────────────────
function SortableBlock({
  block,
  index,
  total,
  lessonId,
  courseId,
  courseTitle,
  moduleTitle,
  quiz,
  onContentChange,
  onStatus,
  registerFlush,
  onDelete,
  onMove,
  onDuplicate,
  onInsertBelow,
}: {
  block: Block;
  index: number;
  total: number;
  lessonId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  quiz?: Quiz | null;
  onContentChange: (id: string, content: Json) => void;
  onStatus: (id: string, state: SaveState | null) => void;
  registerFlush: (id: string, fn: (() => Promise<void>) | null) => void;
  onDelete: (block: Block) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (block: Block) => void;
  onInsertBelow: (index: number) => void;
}) {
  const isTemp = block.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: isTemp,
  });
  const [content, setContent] = useState<Json>(block.content);
  const [revision, setRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [, startSave] = useTransition();

  const latest = useRef<Json>(block.content);
  const lastSaved = useRef<string>(JSON.stringify(block.content));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = BLOCK_META[block.type] ?? {
    label: block.type,
    description: "",
    icon: FileText,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
  };
  const Icon = meta.icon;

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (block.id.startsWith("temp-")) return;
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === lastSaved.current) {
      onStatus(block.id, null);
      return;
    }
    onStatus(block.id, "saving");
    try {
      await updateContentBlock(block.id, lessonId, courseId, snapshot);
      lastSaved.current = json;
      onStatus(block.id, JSON.stringify(latest.current) === json ? null : "dirty");
    } catch (err) {
      onStatus(block.id, "error");
      toast.error(err instanceof Error ? err.message : "Couldn't save this block. Check your connection.");
    }
  }, [block.id, lessonId, courseId, onStatus]);

  useEffect(() => {
    registerFlush(block.id, save);
    return () => registerFlush(block.id, null);
  }, [block.id, registerFlush, save]);

  // Flush pending edits if the block unmounts (navigation, deletion of a neighbour, …).
  useEffect(() => {
    return () => {
      if (timer.current) void save();
    };
  }, [save]);

  function handleChange(next: Json) {
    latest.current = next;
    setContent(next);
    onContentChange(block.id, next);
    if (JSON.stringify(next) === lastSaved.current) return;
    onStatus(block.id, "dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startSave(() => save()), AUTOSAVE_MS);
  }

  async function handleAiEdit() {
    if (aiGenerating || !aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/edit-block-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockType: block.type, currentContent: latest.current, instruction: aiPrompt }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to update content");
      handleChange(data.newContent as Json);
      setRevision((r) => r + 1); // remount the editor so it shows the AI's version
      setAiPrompt("");
      setShowAiAssist(false);
      toast.success("Block rewritten — saving automatically.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI edit failed");
    } finally {
      setAiGenerating(false);
    }
  }

  const canAiAssist = block.type !== "quiz" && block.type !== "tutor_session" && block.type !== "meeting";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-2xl border bg-white transition-shadow",
        isDragging ? "z-20 border-[#fd5523]/50 shadow-2xl" : "border-slate-200/80 hover:shadow-sm",
        isTemp && "opacity-70"
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-2 sm:px-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="hidden h-8 w-6 cursor-grab touch-none items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing sm:flex"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-expanded={!collapsed}
        >
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.bgColor, meta.color)}>
            {isTemp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          </span>
          <span className="truncate text-sm font-semibold text-[#062e39]">{meta.label}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", collapsed && "-rotate-90")} />
        </button>

        {canAiAssist && (
          <button
            type="button"
            onClick={() => setShowAiAssist((v) => !v)}
            disabled={isTemp}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors",
              showAiAssist ? "bg-[#062e39] text-white" : "text-slate-500 hover:bg-[#fff6ee] hover:text-[#fd5523]"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rewrite</span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${meta.label} block actions`}
            disabled={isTemp}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#062e39] data-[popup-open]:bg-slate-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CLASS}>
            <DropdownMenuItem className={ITEM_CLASS} onClick={() => onInsertBelow(index + 1)}>
              <Plus className="h-4 w-4" /> Add block below
            </DropdownMenuItem>
            {block.type !== "quiz" && (
              <DropdownMenuItem className={ITEM_CLASS} onClick={() => onDuplicate({ ...block, content: latest.current })}>
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM_CLASS} disabled={index === 0} onClick={() => onMove(block.id, -1)}>
              <ArrowUp className="h-4 w-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLASS} disabled={index === total - 1} onClick={() => onMove(block.id, 1)}>
              <ArrowDown className="h-4 w-4" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM_CLASS} variant="destructive" onClick={() => onDelete(block)}>
              <Trash2 className="h-4 w-4" /> Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showAiAssist && (
        <div className="mx-2 mb-2 rounded-xl border border-[#fd5523]/20 bg-[#fffaf6] p-3 sm:mx-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="How should AI change this block?"
              disabled={aiGenerating}
              autoFocus
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#062e39] outline-none focus:border-[#fd5523]/50 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAiEdit();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAiEdit}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#fd5523] px-3.5 text-xs font-semibold text-white hover:bg-[#ef4a16] disabled:opacity-50"
            >
              {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Apply
            </button>
          </div>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {["Simplify the language", "Make it more detailed", "Add a real-world example", "Shorten it"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAiPrompt(s)}
                disabled={aiGenerating}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#fd5523]/40 hover:text-[#fd5523]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className={cn("border-t border-slate-100 p-3 sm:p-5", isTemp && "pointer-events-none")}>
          <BlockEditor
            key={revision}
            block={{ ...block, content }}
            lessonId={lessonId}
            courseId={courseId}
            courseTitle={courseTitle}
            moduleTitle={moduleTitle}
            quiz={quiz}
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── Block picker ────────────────────────────────────────────────────────────
function BlockPicker({
  open,
  onOpenChange,
  hasQuiz,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasQuiz: boolean;
  onPick: (type: ContentBlockType) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="pr-8 text-left">
            <DialogTitle className="text-lg font-bold text-[#062e39]">Add a block</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Lessons are built from blocks. Pick one — you can reorder later.
            </DialogDescription>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#fd5523]/40 focus:bg-white"
            />
          </div>
        </DialogHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {TOOLBAR_GROUPS.map((group) => {
            const types = group.types
              .filter((t) => t !== "quiz" || !hasQuiz)
              .filter((t) => {
                if (!q) return true;
                const m = BLOCK_META[t];
                return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || t.includes(q);
              });
            if (types.length === 0) return null;
            return (
              <div key={group.heading}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.heading}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {types.map((type) => {
                    const meta = BLOCK_META[type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => onPick(type)}
                        className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-left transition-colors hover:border-[#fd5523]/40 hover:bg-[#fffaf6] active:scale-[0.99]"
                      >
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.bgColor, meta.color)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#062e39]">{meta.label}</span>
                          <span className="block truncate text-xs text-slate-500">{meta.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: <Check className="h-3.5 w-3.5" />, label: "Saved", cls: "text-emerald-600" },
    dirty: { icon: <PencilLine className="h-3.5 w-3.5" />, label: "Editing…", cls: "text-slate-500" },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Saving…", cls: "text-slate-500" },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: "Not saved", cls: "text-red-600" },
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", map.cls)} aria-live="polite">
      {state === "saved" ? <Cloud className="h-3.5 w-3.5" /> : map.icon}
      <span className="hidden sm:inline">{map.label}</span>
    </span>
  );
}

type NavLesson = { id: string; title: string; href: string } | null;

// ─── Lesson studio ───────────────────────────────────────────────────────────
export function LessonEditorClient({
  lesson,
  courseId,
  courseTitle,
  moduleTitle,
  initialBlocks,
  quiz,
  tenantSlug,
  backHref,
  learnerHref,
  position,
  prevLesson,
  nextLesson,
}: {
  lesson: { id: string; title: string; is_preview: boolean };
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  initialBlocks: Block[];
  quiz?: Quiz | null;
  tenantSlug?: string;
  backHref: string;
  learnerHref: string | null;
  position: { index: number; total: number };
  prevLesson: NavLesson;
  nextLesson: NavLesson;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [title, setTitle] = useState(lesson.title);
  const [isPreview, setIsPreview] = useState(lesson.is_preview);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"edit" | "preview" | "ai">("edit");
  const [asideTab, setAsideTab] = useState<"preview" | "ai">("preview");
  const [statuses, setStatuses] = useState<Record<string, SaveState>>({});
  const flushers = useRef(new Map<string, () => Promise<void>>());
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTitle = useRef(lesson.title);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const setStatus = useCallback((id: string, state: SaveState | null) => {
    setStatuses((prev) => {
      if (state === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev[id] === state ? prev : { ...prev, [id]: state };
    });
  }, []);

  const registerFlush = useCallback((id: string, fn: (() => Promise<void>) | null) => {
    if (fn) flushers.current.set(id, fn);
    else flushers.current.delete(id);
  }, []);

  const overall: SaveState = useMemo(() => {
    const values = Object.values(statuses);
    if (values.includes("error")) return "error";
    if (values.includes("saving")) return "saving";
    if (values.includes("dirty")) return "dirty";
    return "saved";
  }, [statuses]);

  // ── Lesson title autosave ──
  const saveTitle = useCallback(async (value: string) => {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current);
      titleTimer.current = null;
    }
    const clean = value.trim();
    if (!clean || clean === savedTitle.current) {
      setStatus("__title", null);
      return;
    }
    setStatus("__title", "saving");
    try {
      await updateLesson(lesson.id, courseId, { title: clean }, tenantSlug);
      savedTitle.current = clean;
      setStatus("__title", null);
    } catch (err) {
      setStatus("__title", "error");
      toast.error(err instanceof Error ? err.message : "Couldn't save the title.");
    }
  }, [courseId, lesson.id, setStatus, tenantSlug]);

  function handleTitleChange(value: string) {
    setTitle(value);
    setStatus("__title", "dirty");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void saveTitle(value), 1000);
  }

  const flushAll = useCallback(async () => {
    await Promise.all([...flushers.current.values()].map((fn) => fn()));
    if (titleTimer.current) await saveTitle(title);
  }, [saveTitle, title]);

  // Cmd/Ctrl+S saves immediately; warn before leaving with unsaved edits.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flushAll().then(() => toast.success("All changes saved"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flushAll]);

  useEffect(() => {
    if (overall === "saved") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [overall]);

  function togglePreview() {
    const next = !isPreview;
    setIsPreview(next);
    setStatus("__preview", "saving");
    updateLesson(lesson.id, courseId, { is_preview: next }, tenantSlug)
      .then(() => {
        setStatus("__preview", null);
        toast.success(next ? "Free preview on — anyone can open this lesson" : "Enrolled learners only");
      })
      .catch((err) => {
        setIsPreview(!next);
        setStatus("__preview", "error");
        toast.error(err instanceof Error ? err.message : "Couldn't update preview setting.");
      });
  }

  // ── Block operations ──
  async function persistOrder(next: Block[]) {
    const real = next.filter((b) => !b.id.startsWith("temp-"));
    try {
      await reorderContentBlocks(lesson.id, courseId, real.map((b) => b.id));
    } catch {
      toast.error("Couldn't save the new order.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    const next = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(next);
    void persistOrder(next);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const from = blocks.findIndex((b) => b.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= blocks.length) return;
    const next = arrayMove(blocks, from, to);
    setBlocks(next);
    void persistOrder(next);
  }

  async function insertBlock(type: ContentBlockType, content: Json, at: number | null) {
    const tempId = `temp-${Date.now()}`;
    const index = at === null ? blocks.length : Math.min(at, blocks.length);
    const temp: Block = { id: tempId, type, position: index + 1, content };
    let ordered: Block[] = [];
    setBlocks((prev) => {
      ordered = [...prev.slice(0, index), temp, ...prev.slice(index)];
      return ordered;
    });
    setMobileView("edit");

    try {
      const created = await createContentBlock(lesson.id, courseId, type, content);
      const real: Block = {
        id: created.id,
        type: created.type as ContentBlockType,
        position: created.position,
        content: created.content as Json,
      };
      let finalOrder: Block[] = [];
      setBlocks((prev) => {
        finalOrder = prev.map((b) => (b.id === tempId ? real : b));
        return finalOrder;
      });
      // Server appends at the end; reorder if we inserted mid-lesson.
      if (index < ordered.length - 1) void persistOrder(finalOrder.length ? finalOrder : ordered.map((b) => (b.id === tempId ? real : b)));
      requestAnimationFrame(() =>
        document.getElementById(`block-${real.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch {
      toast.error("Couldn't add that block. Please try again.");
      setBlocks((prev) => prev.filter((b) => b.id !== tempId));
    }
  }

  function pickBlock(type: ContentBlockType) {
    setPickerOpen(false);
    void insertBlock(type, DEFAULT_CONTENT[type], insertAt);
    setInsertAt(null);
  }

  function openPicker(at: number | null = null) {
    setInsertAt(at);
    setPickerOpen(true);
  }

  async function deleteBlock(block: Block) {
    const label = BLOCK_META[block.type]?.label ?? "block";
    const extra = block.type === "quiz" ? " Its questions and learners' attempts will be removed." : "";
    if (!window.confirm(`Delete this ${label.toLowerCase()} block?${extra}`)) return;
    const before = blocks;
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setStatus(block.id, null);
    if (block.id.startsWith("temp-")) return;
    try {
      await deleteContentBlock(block.id, lesson.id, courseId);
      toast.success("Block deleted");
    } catch (err) {
      setBlocks(before);
      toast.error(err instanceof Error ? err.message : "Couldn't delete block.");
    }
  }

  const hasQuiz = blocks.some((b) => b.type === "quiz");
  const lessonNumber = position.index >= 0 ? position.index + 1 : null;

  const previewPanel = (
    <LessonPreviewPane title={title} moduleTitle={moduleTitle} blocks={blocks} quiz={quiz} isLiveSync />
  );
  const aiPanel = (
    <AILessonGenerator
      lessonId={lesson.id}
      courseId={courseId}
      lessonTitle={title}
      existingBlockTypes={blocks.map((b) => b.type)}
      onBlocksGenerated={(newBlocks) => {
        setBlocks((prev) => [...prev, ...newBlocks]);
        setMobileView("edit");
        setAsideTab("preview");
        toast.success(`${newBlocks.length} block${newBlocks.length === 1 ? "" : "s"} added`);
      }}
    />
  );

  return (
    <>
      <BlockPicker open={pickerOpen} onOpenChange={setPickerOpen} hasQuiz={hasQuiz} onPick={pickBlock} />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-12 items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <Link
            href={backHref}
            onClick={() => void flushAll()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-[#062e39]"
            aria-label={`Back to ${courseTitle}`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden max-w-[220px] truncate md:inline">{courseTitle}</span>
          </Link>
          <span className="truncate text-xs text-slate-400">
            {lessonNumber ? `Lesson ${lessonNumber} of ${position.total}` : "Lesson"}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SaveIndicator state={overall} />
            <div className="mx-1 h-5 w-px bg-slate-200" />
            {prevLesson ? (
              <Link
                href={prevLesson.href}
                onClick={() => void flushAll()}
                title={`Previous: ${prevLesson.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#062e39]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center text-slate-200"><ChevronLeft className="h-4 w-4" /></span>
            )}
            {nextLesson ? (
              <Link
                href={nextLesson.href}
                onClick={() => void flushAll()}
                title={`Next: ${nextLesson.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#062e39]"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center text-slate-200"><ChevronRight className="h-4 w-4" /></span>
            )}
            {learnerHref && (
              <Link
                href={learnerHref}
                target="_blank"
                className="ml-1 hidden h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[#062e39] hover:bg-slate-50 sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View as learner
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 pb-28 pt-5 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-12 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ── Editor column ──────────────────────────────────────── */}
        <div className={cn("min-w-0 space-y-4", mobileView !== "edit" && "hidden lg:block")}>
          <div>
            <p className="mb-1 truncate text-xs font-medium text-slate-500">{moduleTitle}</p>
            <textarea
              value={title}
              onChange={(e) => handleTitleChange(e.target.value.replace(/\n/g, " "))}
              onBlur={() => void saveTitle(title)}
              rows={1}
              maxLength={200}
              placeholder="Lesson title"
              aria-label="Lesson title"
              className="field-sizing-content w-full resize-none bg-transparent text-2xl font-bold leading-tight tracking-tight text-[#062e39] outline-none placeholder:text-slate-300 sm:text-3xl"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isPreview}
                onClick={togglePreview}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
                  isPreview
                    ? "border-[#fd5523]/30 bg-[#fff6ee] text-[#fd5523]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <span
                  className={cn(
                    "relative h-4 w-7 rounded-full transition-colors",
                    isPreview ? "bg-[#fd5523]" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                      isPreview ? "translate-x-3.5" : "translate-x-0.5"
                    )}
                  />
                </span>
                Free preview
              </button>
              <span className="text-xs text-slate-400">
                {blocks.length} block{blocks.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {blocks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-5 py-10 text-center">
              <p className="text-base font-semibold text-[#062e39]">This lesson is empty</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Start with a block, or let the AI co-author draft the whole lesson for you to edit.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:mx-auto sm:max-w-md sm:grid-cols-4">
                {QUICK_ADD.map((type) => {
                  const meta = BLOCK_META[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => void insertBlock(type, DEFAULT_CONTENT[type], null)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-[#062e39] hover:border-[#fd5523]/40 hover:bg-[#fffaf6]"
                    >
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta.bgColor, meta.color)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openPicker(null)}
                  className="h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  All block types
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAsideTab("ai");
                    setMobileView("ai");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-semibold text-white hover:bg-[#0a4055]"
                >
                  <Sparkles className="h-4 w-4 text-[#fd8d69]" />
                  Draft with AI
                </button>
              </div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {blocks.map((block, i) => (
                    <div key={block.id} id={`block-${block.id}`} className="scroll-mt-32">
                      <SortableBlock
                        block={block}
                        index={i}
                        total={blocks.length}
                        lessonId={lesson.id}
                        courseId={courseId}
                        courseTitle={courseTitle}
                        moduleTitle={moduleTitle}
                        quiz={block.type === "quiz" ? quiz : null}
                        onContentChange={(id, content) =>
                          setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
                        }
                        onStatus={setStatus}
                        registerFlush={registerFlush}
                        onDelete={deleteBlock}
                        onMove={moveBlock}
                        onDuplicate={(b) => void insertBlock(b.type, b.content, i + 1)}
                        onInsertBelow={(at) => openPicker(at)}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {blocks.length > 0 && (
            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={() => openPicker(null)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 transition-colors hover:border-[#fd5523]/40 hover:bg-[#fffaf6] hover:text-[#fd5523]"
              >
                <Plus className="h-4 w-4" />
                Add block
              </button>
              {QUICK_ADD.filter((t) => t !== "quiz" || !hasQuiz).map((type) => {
                const meta = BLOCK_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    title={`Add ${meta.label}`}
                    onClick={() => void insertBlock(type, DEFAULT_CONTENT[type], null)}
                    className={cn("flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white hover:border-[#fd5523]/40", meta.color)}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          )}

          {nextLesson && blocks.length > 0 && (
            <Link
              href={nextLesson.href}
              onClick={() => void flushAll()}
              className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-[#fd5523]/40"
            >
              <span className="min-w-0">
                <span className="block text-xs text-slate-500">Next lesson</span>
                <span className="block truncate text-sm font-semibold text-[#062e39]">{nextLesson.title}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#fd5523]" />
            </Link>
          )}
        </div>

        {/* ── Side panel (desktop) / full view (mobile) ─────────── */}
        <aside className={cn("min-w-0 space-y-3 lg:sticky lg:top-32", mobileView === "edit" && "hidden lg:block")}>
          <div className="hidden grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:grid">
            {(["preview", "ai"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAsideTab(tab)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors",
                  asideTab === tab ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-[#062e39]"
                )}
              >
                {tab === "preview" ? <Eye className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-[#fd5523]" />}
                {tab === "preview" ? "Live preview" : "AI co-author"}
              </button>
            ))}
          </div>
          <div className="lg:hidden">
            {mobileView === "preview" ? previewPanel : mobileView === "ai" ? aiPanel : null}
          </div>
          <div className="hidden lg:block">{asideTab === "preview" ? previewPanel : aiPanel}</div>
        </aside>
      </div>

      {/* ── Mobile action bar ─────────────────────────────────────── */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {[
            { id: "edit" as const, label: "Edit", icon: PencilLine },
            { id: "preview" as const, label: "Preview", icon: Eye },
            { id: "ai" as const, label: "AI", icon: Sparkles },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMobileView(item.id)}
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold",
                mobileView === item.id ? "bg-slate-100 text-[#062e39]" : "text-slate-500"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => openPicker(null)}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#fd5523] text-[11px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </nav>
    </>
  );
}

