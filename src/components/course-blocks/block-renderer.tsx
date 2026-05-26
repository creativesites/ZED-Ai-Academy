"use client";

import { VideoBlock } from "@/components/learner/content-blocks/video-block";
import { TextBlock } from "@/components/learner/content-blocks/text-block";
import { ImageBlock } from "@/components/learner/content-blocks/image-block";
import { CalloutBlock } from "@/components/learner/content-blocks/callout-block";
import { ToolSpotlightBlock } from "@/components/learner/content-blocks/tool-spotlight-block";
import { BeforeAfterBlock } from "@/components/learner/content-blocks/before-after-block";
import { ResourceBlock } from "@/components/learner/content-blocks/resource-block";
import { AiPromptBlock } from "@/components/learner/content-blocks/ai-prompt-block";
import { StepsBlock } from "@/components/learner/content-blocks/steps-block";
import { ChecklistBlock } from "@/components/learner/content-blocks/checklist-block";
import { KeyTakeawayBlock } from "@/components/learner/content-blocks/key-takeaway-block";
import { ExpertNoteBlock } from "@/components/learner/content-blocks/expert-note-block";
import { ComparisonTableBlock } from "@/components/learner/content-blocks/comparison-table-block";
import { CaseStudyBlock } from "@/components/learner/content-blocks/case-study-block";
import { MeetingBlock } from "@/components/learner/content-blocks/meeting-block";
import { PracticeExerciseBlock } from "@/components/learner/content-blocks/practice-exercise-block";
import { LearningObjectivesBlock } from "@/components/learner/content-blocks/learning-objectives-block";
import { GlossaryBlock } from "@/components/learner/content-blocks/glossary-block";
import { DiscussionPromptBlock } from "@/components/learner/content-blocks/discussion-prompt-block";
import { AssignmentBlock } from "@/components/learner/content-blocks/assignment-block";
import { RiskAssessmentBlock } from "@/components/learner/content-blocks/risk-assessment-block";

export type Lesson = { id: string; title: string; position: number; is_preview: boolean };
export type Module = { id: string; title: string; position: number; lessons: Lesson[] };
export type ContentBlock = { id: string; type: string; position: number; content: Record<string, unknown> };

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string | null;
  position: number;
};

export type Quiz = {
  id: string;
  title: string | null;
  pass_threshold: number;
  max_attempts: number;
  quiz_questions: QuizQuestion[];
} | null;

export function BlockRenderer({
  block,
  bookings,
  practiceSubmissions,
  courseId,
  lessonId,
  onLaunchStudio,
  previewMode = false,
}: {
  block: ContentBlock;
  bookings?: unknown[];
  practiceSubmissions?: { exercise_block_id?: string }[];
  courseId?: string;
  lessonId?: string;
  onLaunchStudio?: (initialTool?: string) => void;
  previewMode?: boolean;
}) {
  const { type, content, id } = block;

  switch (type) {
    case "video":
      return <VideoBlock content={content} />;
    case "text":
      return <TextBlock content={content} />;
    case "image":
      return <ImageBlock content={content} />;
    case "callout":
      return <CalloutBlock content={content} />;
    case "tool_spotlight":
      return <ToolSpotlightBlock content={content} />;
    case "before_after":
      return <BeforeAfterBlock content={content} />;
    case "resource":
      return <ResourceBlock content={content} />;
    case "ai_prompt":
      return <AiPromptBlock content={content} />;
    case "steps":
      return <StepsBlock content={content} />;
    case "checklist":
      return <ChecklistBlock content={content} />;
    case "key_takeaway":
      return <KeyTakeawayBlock content={content} />;
    case "expert_note":
      return <ExpertNoteBlock content={content} />;
    case "comparison_table":
      return <ComparisonTableBlock content={content} />;
    case "case_study":
      return <CaseStudyBlock content={content} />;
    case "meeting":
      return (
        <MeetingBlock
          content={content}
          bookings={bookings || []}
          courseId={courseId}
          lessonId={lessonId}
          previewMode={previewMode}
        />
      );
    case "practice_exercise": {
      const submission = practiceSubmissions?.find((s) => s.exercise_block_id === id);
      return (
        <PracticeExerciseBlock
          blockId={id}
          content={content}
          submission={submission}
          onLaunchStudio={onLaunchStudio}
          previewMode={previewMode}
        />
      );
    }
    case "learning_objectives":
      return <LearningObjectivesBlock content={content} />;
    case "glossary":
      return <GlossaryBlock content={content} />;
    case "discussion_prompt":
      return <DiscussionPromptBlock content={content} />;
    case "assignment":
      return <AssignmentBlock content={content} />;
    case "risk_assessment":
      return <RiskAssessmentBlock content={content} />;
    default:
      return (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          Unknown block type: {type}
        </div>
      );
  }
}
