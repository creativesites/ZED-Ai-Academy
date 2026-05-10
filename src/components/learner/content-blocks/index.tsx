"use client";

import { VideoBlock } from "./video-block";
import { TextBlock } from "./text-block";
import { ImageBlock } from "./image-block";
import { CalloutBlock } from "./callout-block";
import { ToolSpotlightBlock } from "./tool-spotlight-block";
import { BeforeAfterBlock } from "./before-after-block";
import { ResourceBlock } from "./resource-block";
import { AiPromptBlock } from "./ai-prompt-block";
import { StepsBlock } from "./steps-block";
import { ChecklistBlock } from "./checklist-block";
import { KeyTakeawayBlock } from "./key-takeaway-block";
import { ExpertNoteBlock } from "./expert-note-block";
import { ComparisonTableBlock } from "./comparison-table-block";
import { CaseStudyBlock } from "./case-study-block";
import { MeetingBlock } from "./meeting-block";
import { PracticeExerciseBlock } from "./practice-exercise-block";
import { ContentBlock } from "./types";

export function BlockRenderer({
  block,
  bookings,
  practiceSubmissions,
  courseId,
  lessonId,
  onLaunchStudio
}: {
  block: ContentBlock;
  bookings?: any[];
  practiceSubmissions?: any[];
  courseId?: string;
  lessonId?: string;
  onLaunchStudio?: (initialTool?: string) => void;
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
      return <MeetingBlock content={content} bookings={bookings || []} courseId={courseId} lessonId={lessonId} />;
    case "practice_exercise":
      const submission = practiceSubmissions?.find((s) => s.exercise_block_id === id);
      return (
        <PracticeExerciseBlock 
          blockId={id} 
          content={content} 
          submission={submission}
          onLaunchStudio={onLaunchStudio}
        />
      );
    default:
      return (
        <div className="p-4 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
          Unknown block type: {type}
        </div>
      );
  }
}

export * from "./types";
export {
  VideoBlock,
  TextBlock,
  ImageBlock,
  CalloutBlock,
  ToolSpotlightBlock,
  BeforeAfterBlock,
  ResourceBlock,
  AiPromptBlock,
  StepsBlock,
  ChecklistBlock,
  KeyTakeawayBlock,
  ExpertNoteBlock,
  ComparisonTableBlock,
  CaseStudyBlock,
  MeetingBlock,
  PracticeExerciseBlock,
};
