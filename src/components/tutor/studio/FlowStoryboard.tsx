"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutList,
  Loader2,
  MessageCircleQuestion,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FlowDiffEntry, FlowStep } from "@/lib/tutor/authoring/flow";
import { cn } from "@/lib/utils";

const QUICK_AI_EDITS = [
  "Make step 2 easier",
  "Add a kwacha example",
  "Make questions shorter",
  "Add a multiple-choice check",
];

function SortableStepCard({
  step,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
  canRemove,
}: {
  step: FlowStep;
  index: number;
  total: number;
  onUpdate: (patch: Partial<FlowStep>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const goalId = `step-goal-${step.id}`;
  const boardId = `step-board-${step.id}`;
  const checkId = `step-check-${step.id}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border bg-white p-3.5 transition-shadow",
        isDragging ? "z-20 border-brand shadow-xl" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Drag step ${index + 1} to reorder`}
            {...attributes}
            {...listeners}
            className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-[11px] font-bold text-white">
            Step {index + 1}
          </span>
          <span className="text-[11px] font-medium text-slate-400">{step.id}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move step ${index + 1} up`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move step ${index + 1} down`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove step ${index + 1}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor={goalId} className="text-[11px] font-semibold text-slate-600">
            Step goal
          </Label>
          <Textarea
            id={goalId}
            rows={2}
            value={step.goal}
            onChange={(e) => onUpdate({ goal: e.target.value })}
            placeholder="What the AI teacher teaches or checks here..."
            className="resize-none bg-slate-50/50 text-xs"
          />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={boardId} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <LayoutList className="h-3 w-3 text-brand-text" />
              Board content
            </Label>
            <Textarea
              id={boardId}
              rows={2}
              value={step.boardContent}
              onChange={(e) => onUpdate({ boardContent: e.target.value })}
              placeholder="Key points, worked steps, or equation on the board..."
              className="resize-none bg-slate-50/50 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={checkId} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <MessageCircleQuestion className="h-3 w-3 text-teal-600" />
              Check question
            </Label>
            <Textarea
              id={checkId}
              rows={2}
              value={step.checkQuestion}
              onChange={(e) => onUpdate({ checkQuestion: e.target.value })}
              placeholder="What the teacher asks the learner to check understanding..."
              className="resize-none bg-slate-50/50 text-xs"
            />
          </div>
        </div>

        {step.boardContent.trim() && (
          <div className="rounded-xl border border-slate-200/80 bg-ink/[0.03] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Board preview</p>
            <p className="mt-0.5 whitespace-pre-line text-xs text-ink">{step.boardContent}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function FlowStoryboard({
  steps,
  onStepsChange,
  onAiRevise,
  isRevising = false,
  diff = null,
  canUndo = false,
  onUndo,
  onDismissDiff,
  minSteps = 1,
}: {
  steps: FlowStep[];
  onStepsChange: (next: FlowStep[]) => void;
  onAiRevise?: (instruction: string) => Promise<void>;
  isRevising?: boolean;
  diff?: FlowDiffEntry[] | null;
  canUndo?: boolean;
  onUndo?: () => void;
  onDismissDiff?: () => void;
  minSteps?: number;
}) {
  const [instruction, setInstruction] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onStepsChange(arrayMove(steps, oldIndex, newIndex));
  }

  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    onStepsChange(arrayMove(steps, index, target));
  }

  function updateStep(index: number, patch: Partial<FlowStep>) {
    onStepsChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    let n = steps.length + 1;
    const used = new Set(steps.map((s) => s.id));
    while (used.has(`step-${n}`)) n++;
    onStepsChange([
      ...steps,
      { id: `step-${n}`, goal: "", boardContent: "", checkQuestion: "" },
    ]);
  }

  async function submitInstruction(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = instruction.trim();
    if (!clean || !onAiRevise || isRevising) return;
    await onAiRevise(clean);
    setInstruction("");
  }

  return (
    <div className="space-y-3">
      {onAiRevise && (
        <form
          onSubmit={submitInstruction}
          className="space-y-2 rounded-2xl border border-brand/25 bg-brand-soft p-3"
        >
          <Label htmlFor="ai-flow-edit-bar" className="text-[11px] font-bold uppercase tracking-wider text-ink">
            Edit flow with one instruction
          </Label>
          <div className="flex gap-2">
            <Input
              id="ai-flow-edit-bar"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isRevising}
              placeholder="e.g. make step 2 easier, or add a kwacha example"
              className="bg-white text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isRevising || !instruction.trim()}
              className="shrink-0 rounded-xl bg-brand text-xs font-bold text-white hover:bg-brand-hover"
            >
              {isRevising ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Apply
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_AI_EDITS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isRevising}
                onClick={() => setInstruction(chip)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-brand/50 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {chip}
              </button>
            ))}
          </div>
        </form>
      )}

      {diff && diff.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-0.5">
            <p className="font-bold">AI updated your flow:</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-emerald-900">
              {diff.slice(0, 4).map((d, idx) => (
                <li key={idx}>{d.label}</li>
              ))}
              {diff.length > 4 && <li>+{diff.length - 4} more changes</li>}
            </ul>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canUndo && onUndo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUndo}
                className="h-8 rounded-lg border-emerald-300 bg-white text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Undo
              </Button>
            )}
            {onDismissDiff && (
              <button
                type="button"
                onClick={onDismissDiff}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Keep
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Flow Steps ({steps.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          className="h-7 rounded-lg text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add step
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {steps.map((step, idx) => (
              <SortableStepCard
                key={step.id}
                step={step}
                index={idx}
                total={steps.length}
                canRemove={steps.length > minSteps}
                onUpdate={(patch) => updateStep(idx, patch)}
                onMove={(dir) => moveStep(idx, dir)}
                onRemove={() => onStepsChange(steps.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
