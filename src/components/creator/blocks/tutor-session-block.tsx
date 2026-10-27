"use client";

import { useEffect, useState } from "react";
import { listTutorScenariosForCourse, type TutorScenarioOption } from "@/actions/tutor-scenarios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import {
  TUTOR_SESSION_STYLES,
  TUTOR_STYLE_LABELS,
  type TutorSessionBlock,
  type TutorSessionStyle,
} from "@/lib/tutor/tutor-session-block";

export type TutorSessionBlockContent = Partial<TutorSessionBlock>;

const STYLE_HINTS: Record<TutorSessionStyle, string> = {
  scene: "A role-play at the end of the lesson. The tutor plays a character and the learner responds.",
  guided_lesson: "The tutor teaches the lesson step by step, checks understanding with spoken questions, then runs a short scene.",
  oral_check: "An exam-style speaking task with a rubric. The learner answers the tutor's prompts.",
};

const VISIBILITY_LABEL: Record<TutorScenarioOption["visibility"], string> = {
  course: "This course",
  tenant_library: "Academy library",
  platform: "ZAI starter",
};

export function TutorSessionBlockEditor({
  content,
  courseId,
  lessonId,
  onChange,
}: {
  content: TutorSessionBlockContent;
  courseId: string;
  lessonId: string;
  onChange: (c: TutorSessionBlockContent) => void;
}) {
  const [scenarioId, setScenarioId] = useState(content.scenarioId ?? "");
  const [style, setStyle] = useState<TutorSessionStyle>(content.style ?? "scene");
  const [required, setRequired] = useState(content.required ?? false);
  const [title, setTitle] = useState(content.title ?? "");
  const [intro, setIntro] = useState(content.intro ?? "");
  const [scenarios, setScenarios] = useState<TutorScenarioOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listTutorScenariosForCourse(courseId)
      .then((list) => alive && setScenarios(list))
      .catch((err: unknown) => alive && setLoadError(err instanceof Error ? err.message : "Could not load scenarios"));
    return () => {
      alive = false;
    };
  }, [courseId]);

  function emit(patch: TutorSessionBlockContent) {
    onChange({ scenarioId, style, required, title, intro, ...patch });
  }

  const selected = scenarios?.find((s) => s.id === scenarioId) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Scenario</Label>
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!loadError && scenarios === null && <p className="text-sm text-slate-500">Loading scenarios…</p>}
        {scenarios && scenarios.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">No speaking scenarios yet</p>
            <p className="mt-1">
              A scenario is a role-play with a persona, goals and target words. Scenarios are created in the
              tutor authoring tools, which are not in the course studio yet. Once one is published for this
              course, the academy library, or ZAI&apos;s starter packs, it appears here. See{" "}
              <code className="text-xs">docs/LANGUAGE_IMPLEMENTATION_PLAN.md</code> (section 2.5) for how scenarios work.
            </p>
          </div>
        )}
        {scenarios && scenarios.length > 0 && (
          <select
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value);
              emit({ scenarioId: e.target.value });
            }}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#fd5523]/40"
          >
            <option value="">Choose a scenario…</option>
            {(["course", "tenant_library", "platform"] as const).map((vis) => {
              const group = scenarios.filter((s) => s.visibility === vis);
              if (group.length === 0) return null;
              return (
                <optgroup key={vis} label={VISIBILITY_LABEL[vis]}>
                  {group.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
        {selected && (
          <p className="text-xs text-slate-500">
            {selected.persona ? `${selected.persona.displayName ?? selected.persona.name} · ` : ""}
            up to {selected.maxMinutes} min · {selected.goal}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Style</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TUTOR_SESSION_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => {
                setStyle(s);
                emit({ style: s });
              }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                style === s
                  ? "border-[#fd5523] bg-[#fff6ee] ring-2 ring-[#fd5523]/20"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <span className="block text-sm font-semibold text-slate-800">{TUTOR_STYLE_LABELS[s]}</span>
              <span className="mt-1 block text-xs text-slate-500">{STYLE_HINTS[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => {
            setRequired(e.target.checked);
            emit({ required: e.target.checked });
          }}
          className="mt-0.5 h-4 w-4 accent-[#fd5523]"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800">Required to complete the lesson</span>
          <span className="block text-xs text-slate-500">
            Learners must finish this practice before they can mark the lesson complete.
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Title (optional)</Label>
        <Input
          value={title}
          maxLength={120}
          onChange={(e) => {
            setTitle(e.target.value);
            emit({ title: e.target.value });
          }}
          placeholder="e.g. Order tea using today's words"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Intro for the learner (optional)</Label>
        <Textarea
          value={intro}
          maxLength={600}
          rows={3}
          onChange={(e) => {
            setIntro(e.target.value);
            emit({ intro: e.target.value });
          }}
          placeholder="What the learner should focus on before they start."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!selected}
          onClick={() => setPreviewOpen(true)}
        >
          Preview with tutor
        </Button>
        {!selected && <span className="text-xs text-slate-500">Choose a scenario to preview it.</span>}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[85vh] max-w-5xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Preview speaking practice</DialogTitle>
          <DialogDescription className="sr-only">
            Runs the tutor session as a learner would see it. Previews count as lesson sessions.
          </DialogDescription>
          {previewOpen && selected && (
            <TutorSession
              origin="lesson"
              lessonId={lessonId}
              scenarioId={selected.id}
              scene={selected.scene}
              look={selected.persona?.look}
              preview={{
                teacherName: selected.persona?.displayName ?? selected.persona?.name,
                title: title || selected.title,
                goal: selected.goal,
                maxMinutes: selected.maxMinutes,
                modes: selected.modes,
              }}
              onExit={() => setPreviewOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
