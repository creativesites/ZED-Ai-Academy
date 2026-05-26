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
import { LearningObjectivesBlockEditor } from "@/components/creator/blocks/learning-objectives-block";
import { GlossaryBlockEditor } from "@/components/creator/blocks/glossary-block";
import { DiscussionPromptBlockEditor } from "@/components/creator/blocks/discussion-prompt-block";
import { AssignmentBlockEditor } from "@/components/creator/blocks/assignment-block";
import { RiskAssessmentBlockEditor } from "@/components/creator/blocks/risk-assessment-block";
import { QuizBuilder } from "@/components/creator/quiz-builder";
import { AILessonGenerator } from "@/components/creator/ai-lesson-generator";
import { LessonPreviewPane } from "@/components/creator/lesson-preview-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  X,
  Target,
  BookMarked,
  MessagesSquare,
  ClipboardCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContentBlockType, Json } from "@/types/database";

// Types and constants (same as before)
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
  learning_objectives: { label: "Objectives", icon: Target,               color: "text-sky-600",     bgColor: "bg-sky-50" },
  glossary:       { label: "Glossary",       icon: BookMarked,             color: "text-violet-600",  bgColor: "bg-violet-50" },
  discussion_prompt: { label: "Discussion",  icon: MessagesSquare,         color: "text-sky-700",     bgColor: "bg-sky-50" },
  assignment:     { label: "Assignment",     icon: ClipboardCheck,         color: "text-emerald-700", bgColor: "bg-emerald-50" },
  risk_assessment:{ label: "Risk",           icon: ShieldAlert,            color: "text-red-600",     bgColor: "bg-red-50" },
};

const TOOLBAR_GROUPS: { heading: string; types: ContentBlockType[] }[] = [
  { heading: "Media & Visuals", types: ["video", "image", "before_after"] },
  { heading: "Knowledge Delivery", types: ["text", "callout", "tool_spotlight", "resource"] },
  { heading: "Practical Learning", types: ["ai_prompt", "steps", "checklist", "key_takeaway", "practice_exercise", "assignment"] },
  { heading: "Classroom & School", types: ["learning_objectives", "glossary", "discussion_prompt"] },
  { heading: "Technical & Safety", types: ["risk_assessment"] },
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
  learning_objectives: { title: "Learning Objectives", objectives: [""] } as Json,
  glossary:       { title: "Glossary", terms: [{ term: "", definition: "" }] } as Json,
  discussion_prompt: { title: "Discussion Prompt", prompt: "", guidance: [""], mode: "group" } as Json,
  assignment:     { title: "Assignment", summary: "", deliverables: [""], assessment: "", estimated_minutes: 30 } as Json,
  risk_assessment:{ title: "Risk Assessment", rows: [{ hazard: "", risk: "Medium", control: "" }] } as Json,
};

function LessonEditorSidebarContent({
  groups,
  hasQuiz,
  adding,
  addBlock,
  lessonId,
  courseId,
  lessonTitle,
}: {
  groups: { heading: string; types: ContentBlockType[] }[];
  hasQuiz: boolean;
  adding: boolean;
  addBlock: (type: ContentBlockType) => void;
  lessonId: string;
  courseId: string;
  lessonTitle: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-0 bg-white p-4 shadow-xl sm:rounded-[2.5rem] sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-[#062e39] sm:mb-6">
          <Plus className="h-4 w-4 text-[#fd5523] sm:h-5 sm:w-5" />
          <h3 className="text-xs font-bold uppercase tracking-wider sm:text-sm">Block Library</h3>
        </div>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.heading}>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:mb-3 sm:text-[10px]">
                {group.heading}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                {group.types
                  .filter((type) => type !== "quiz" || !hasQuiz)
                  .map((type) => {
                    const meta = BLOCK_META[type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => addBlock(type)}
                        disabled={adding}
                        className="group flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-2 text-left transition-all hover:border-[#fd5523]/30 hover:bg-[#fff6ee]/20 hover:shadow-md sm:gap-3 sm:p-3"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 sm:h-10 sm:w-10 sm:rounded-xl ${meta.bgColor} ${meta.color}`}
                        >
                          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <span className="text-xs font-bold text-[#062e39] sm:text-sm">{meta.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AILessonGenerator lessonId={lessonId} courseId={courseId} lessonTitle={lessonTitle} />
    </div>
  );
}

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
  if (block.type === "quiz")
    return <QuizBuilder lessonId={block.id} courseId={courseId} initialQuiz={quiz ?? null} initialQuestions={quiz?.quiz_questions ?? []} />;

  return <p className="text-sm text-slate-500">Block type &quot;{block.type}&quot; editor coming soon.</p>;
}

// --- SortableBlock (adjusted padding for mobile) ---
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
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const meta = BLOCK_META[block.type] ?? { label: block.type, icon: FileText, color: "text-slate-500", bgColor: "bg-slate-50" };
  const Icon = meta.icon;

  function handleSave() {
    if (block.id.startsWith("temp-")) {
      toast.error("Block is still saving. Please wait.");
      return;
    }
    startSave(async () => {
      await updateContentBlock(block.id, lessonId, courseId, content as Json);
      onSave(block.id, content as Json);
      toast.success("Block saved");
    });
  }

  function handleDelete() {
    if (!confirm("Delete this block?")) return;
    if (block.id.startsWith("temp-")) {
      onDelete(block.id);
      return;
    }
    startDelete(async () => {
      await deleteContentBlock(block.id, lessonId, courseId);
      onDelete(block.id);
      toast.success("Block deleted");
    });
  }

  async function handleAiEdit() {
    if (aiGenerating || !aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/edit-block-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type,
          currentContent: content,
          instruction: aiPrompt
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to update content");

      setContent(data.newContent);
      setAiPrompt("");
      setShowAiAssist(false);
      toast.success("AI updated block! Click 'Save' to keep changes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI content update failed");
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group overflow-hidden rounded-2xl border-2 transition-all sm:rounded-[2rem] ${
        isDragging 
          ? "opacity-50 shadow-2xl z-20 border-[#fd5523]" 
          : "border-slate-100 bg-white hover:border-[#fd5523]/20 hover:shadow-xl hover:shadow-[#062e39]/5"
      }`}
    >
      {/* Block header - more compact on mobile */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 bg-[#fffaf6]/30 p-3 sm:flex-nowrap sm:gap-4 sm:p-5">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-slate-400 transition-colors hover:text-[#fd5523]">
          <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.bgColor} ${meta.color} sm:h-10 sm:w-10 sm:rounded-xl`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#062e39] sm:text-sm sm:tracking-widest">{meta.label}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 sm:gap-2">
          {/* AI Assist Button */}
          <Button
            onClick={() => setShowAiAssist((v) => !v)}
            disabled={aiGenerating}
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 sm:h-9 px-2.5 text-xs font-bold sm:px-3"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            <span className="hidden xs:inline">AI Assist</span>
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-8 rounded-full bg-[#fd5523] px-3 text-xs font-bold text-white hover:bg-[#ef4a16] sm:h-9 sm:px-4 sm:text-sm"
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin sm:mr-1.5" /> : <Save className="mr-1 h-3 w-3 sm:mr-1.5" />}
            <span className="hidden sm:inline">Save</span>
          </Button>

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 sm:h-8 sm:w-8"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* AI Assist Expandable Form Panel */}
      {showAiAssist && (
        <div className="border-b border-blue-100 bg-blue-50/20 p-4 sm:p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">AI Block Assistant</span>
            </div>
            
            <p className="text-xs text-blue-900/60 leading-relaxed">
              Type custom instructions (e.g., "rewrite with simpler language", "make it look like a checklist", "add 3 more steps") and the AI will update this block's content for you.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="What changes should the AI make to this block?"
                disabled={aiGenerating}
                className="flex-1 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAiEdit();
                  }
                }}
              />
              <Button
                onClick={handleAiEdit}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
              </Button>
            </div>
            
            {/* Quick Suggestions for Teachers */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "✍️ Simplify the text",
                "📈 Add advanced details",
                "💡 Turn into a friendly tip",
                "🎯 Focus on target objectives",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setAiPrompt(s.slice(3))}
                  disabled={aiGenerating}
                  className="rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[10px] text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="p-4 sm:p-6">
          <BlockEditor
            block={{ ...block, content: content as Json }}
            lessonId={lessonId}
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

// --- Simple Onboarding Tour (localStorage based) ---
function LessonEditorTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Welcome to the Lesson Studio!", content: "Here you can craft engaging lessons using flexible content blocks. Let's walk you through the key features." },
    { title: "Lesson Title & Settings", content: "Edit your lesson title and toggle free preview mode. Don't forget to save your changes with the Commit button." },
    { title: "Content Blocks", content: "Each block (video, text, quiz, etc.) is a building block. You can drag to reorder, save individually, or collapse them." },
    { title: "Adding New Blocks (Mobile)", content: "On mobile, tap the floating orange + button to open the block library. Choose any block type to add it to your lesson." },
    { title: "Adding New Blocks (Desktop)", content: "On larger screens, the block library stays on the right sidebar – just click any block to insert it instantly." },
    { title: "AI Lesson Generator", content: "Need inspiration? Use the AI panel to auto‑generate entire lessons or individual blocks based on your topic." },
  ];

  const next = () => {
    if (step + 1 < steps.length) setStep(step + 1);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-w-md rounded-2xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#062e39]">{steps[step].title}</h3>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed">{steps[step].content}</p>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-[#fd5523]" : "bg-slate-200"}`} />
              ))}
            </div>
            <Button onClick={next} className="rounded-full bg-[#fd5523] px-6 text-white hover:bg-[#ef4a16]">
              {step + 1 === steps.length ? "Get Started" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main LessonEditorClient (Mobile‑First) ---
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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem("lesson_editor_tour_seen");
  });

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
    const tempId = `temp-${Date.now()}`;
    const newBlock: Block = {
      id: tempId,
      type,
      position: blocks.length + 1,
      content: DEFAULT_CONTENT[type],
    };

    // Optimistically update UI immediately
    setBlocks((prev) => [...prev, newBlock]);
    toast.success(`${BLOCK_META[type]?.label ?? type} block added`);

    startAdd(async () => {
      try {
        const created = await createContentBlock(lesson.id, courseId, type, DEFAULT_CONTENT[type]);
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === tempId
              ? {
                  id: created.id,
                  type: created.type as ContentBlockType,
                  position: created.position,
                  content: created.content as Json,
                }
              : b
          )
        );
      } catch (error) {
        console.error("Failed to create block:", error);
        toast.error("Failed to save new block. Please try again.");
        setBlocks((prev) => prev.filter((b) => b.id !== tempId));
      }
    });
  }

  const hasQuiz = blocks.some((b) => b.type === "quiz");

  return (
    <>
      {showTour && (
        <LessonEditorTour onClose={() => {
          localStorage.setItem("lesson_editor_tour_seen", "true");
          setShowTour(false);
        }} />
      )}

      <div className="space-y-6 pb-24 sm:space-y-10 sm:pb-0">
        {/* Mobile FAB (only visible on small screens) */}
        <div className="fixed bottom-6 right-6 z-40 block sm:hidden">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fd5523] text-white shadow-xl transition-all hover:scale-105 hover:bg-[#ef4a16] active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile bottom sheet */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:hidden">
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white animate-in slide-in-from-bottom">
              <div className="sticky top-0 pt-4 px-4 flex items-center justify-between bg-white w-full pb-2">
                <h2 className="text-xl font-bold text-[#062e39]">Add Content</h2>
                <button onClick={() => setShowMobileSidebar(false)} className="rounded-full p-2 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <LessonEditorSidebarContent
                groups={TOOLBAR_GROUPS}
                hasQuiz={hasQuiz}
                adding={adding}
                addBlock={addBlock}
                lessonId={lesson.id}
                courseId={courseId}
                lessonTitle={title}
              />
            </div>
          </div>
        )}

        {/* Header / Meta Section */}
        <section className="rounded-2xl bg-gradient-to-r from-[#062e39] to-[#0a4055] p-5 shadow-2xl sm:rounded-[2.5rem] sm:p-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#fd5523] shadow-lg sm:h-12 sm:w-12 sm:rounded-2xl">
                <Pencil className="h-4 w-4 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 sm:text-xs">Lesson Studio</p>
                <h1 className="text-xl font-bold text-white tracking-tight sm:text-3xl">
                  {title || "Untitled Lesson"}
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson title..."
                className="h-10 flex-1 rounded-xl border-white/10 bg-white/10 text-base font-medium text-white placeholder:text-white/30 focus:border-[#fd8d69] focus:ring-[#fd8d69]/10 sm:h-14 sm:rounded-2xl sm:text-xl sm:font-bold"
              />
              
              <label className="group relative mb-12 flex h-16 w-full sm:w-fit shrink-0 items-center justify-between sm:justify-start gap-6 cursor-pointer select-none rounded-2xl border border-white/10 bg-white/[0.03] p-3 pl-4 pr-4 sm:pr-5 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/20 active:scale-[0.99] shadow-lg">
                <input
                  type="checkbox"
                  checked={isPreview}
                  onChange={(e) => setIsPreview(e.target.checked)}
                  className="peer sr-only"
                />
                
                {/* Text Labels - Shifted to left side for standard mobile layout rhythm */}
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    "text-xs font-black uppercase tracking-wider transition-colors duration-200",
                    isPreview ? "text-[#fd8d69]" : "text-white/60"
                  )}>
                    {isPreview ? "Public Preview" : "Private Lesson"}
                  </span>
                  <span className="text-sm font-black text-white tracking-wide mt-0.5">
                    {isPreview ? "FREE FOR ANYONE" : "ENROLLED MEMBERS"}
                  </span>
                </div>

                {/* Custom Toggle Track - Scaled up for easy mobile viewing */}
                <div className="relative mt-6 h-7 w-12 shrink-0 rounded-full border border-white/10 bg-black/40 transition-all duration-200 peer-checked:bg-[#fd5523] peer-checked:border-[#fd5523] shadow-inner">
                  {/* Toggle Thumb */}
                  <div className={cn(
                    "absolute top-[3px] left-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-all duration-200 ease-out",
                    isPreview ? "translate-x-5" : "translate-x-0"
                  )}>
                    {isPreview ? (
                      <Eye className="h-3 w-3 text-[#fd5523]" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-400" />
                    )}
                  </div>
                </div>

                {/* Ambient Glow Effect when Active */}
                {isPreview && (
                  <div className="absolute inset-0 rounded-2xl bg-[#fd5523]/[0.03] blur-md pointer-events-none" />
                )}
              </label>
              <Button
                onClick={handleSaveMeta}
                disabled={savingMeta}
                className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-[#062e39] shadow-xl transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95 sm:h-14 sm:rounded-2xl sm:px-8 sm:text-lg"
              >
                {savingMeta ? <Loader2 className="mr-1 h-4 w-4 animate-spin sm:mr-2 sm:h-5 sm:w-5" /> : <Save className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />}
                <span className="hidden sm:inline">Commit Changes</span>
                <span className="sm:hidden">Save</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Main Grid: Content Stack + Preview/Tools */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] max-w-100">
          {/* Content Blocks */}
          <div className="space-y-4 sm:space-y-6 max-w-100 ">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-bold text-[#062e39] sm:text-xl">Content Stack</h2>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">{blocks.length} Blocks</p>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="space-y-3 sm:space-y-4 px-4">
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
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center sm:rounded-3xl sm:py-24">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523] sm:h-20 sm:w-20 sm:rounded-3xl">
                  <Sparkles className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <h3 className="text-xl font-bold text-[#062e39] sm:text-2xl">Empty Lesson Canvas</h3>
                <p className="mx-auto mt-2 max-w-xs px-2 text-sm text-slate-500 sm:max-w-sm sm:text-base">
                  Tap the <span className="font-bold text-[#fd5523]">+ button</span> (bottom right) to add your first content block.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <LessonPreviewPane
              title={title}
              moduleTitle={moduleTitle}
              blocks={blocks}
              quiz={quiz}
            />

            <div className="hidden sm:block xl:hidden">
              <LessonEditorSidebarContent
                groups={TOOLBAR_GROUPS}
                hasQuiz={hasQuiz}
                adding={adding}
                addBlock={addBlock}
                lessonId={lesson.id}
                courseId={courseId}
                lessonTitle={title}
              />
            </div>

            <div className="hidden xl:block xl:sticky xl:top-8 xl:space-y-6">
              <LessonEditorSidebarContent
                groups={TOOLBAR_GROUPS}
                hasQuiz={hasQuiz}
                adding={adding}
                addBlock={addBlock}
                lessonId={lesson.id}
                courseId={courseId}
                lessonTitle={title}
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
