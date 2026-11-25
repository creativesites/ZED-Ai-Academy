"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Pencil,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import {
  addLearnerGoal,
  deleteMemory,
  exportMyLearnerData,
  forgetCourse,
  saveMyLearnerPreferences,
  setMemoryHidden,
  updateMemoryText,
  type MemoryActionResult,
} from "@/actions/learner-memory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LITE_STORAGE_KEY } from "@/lib/tutor/lite-mode";
import type { LearnerPreferences } from "@/lib/tutor/learner/preferences";
import type {
  TeacherKnowsData,
  TeacherKnowsMemory,
  TeacherKnowsObjective,
} from "@/lib/tutor/learner/teacher-knows-server";

// "What <Teacher> knows about you" (P1-08, UX §2 /practice/about-me, journey J6). Learners see every
// memory the teacher may use, correct it, hide it ("This isn't right"), delete it, forget a course and
// export everything. Each item says who else can see it.

const KIND_LABEL: Record<TeacherKnowsMemory["kind"], string> = {
  goal: "Goal",
  background: "About you",
  preference: "How you like to learn",
  episode: "Session",
  misconception: "To revisit",
  note: "Note",
};

const SOURCE_LABEL: Record<TeacherKnowsMemory["source"], string> = {
  learner_stated: "You told",
  session_summary: "From a session with",
  teacher_observed: "Noticed by",
  staff_note: "Added by your academy for",
};

const LEVEL_LABEL = ["Needs review", "Developing", "Almost secure", "Secure"];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function VisibilityTag({ visibility }: { visibility: "private" | "staff" }) {
  return visibility === "staff" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
      <Users className="h-3 w-3" aria-hidden />
      Your academy&apos;s teachers can see this
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      <Lock className="h-3 w-3" aria-hidden />
      Only you and your AI teacher
    </span>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`h-${title}`}>
      <div>
        <h2 id={`h-${title}`} className="text-lg font-black text-[#062e39]">
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function WhatTeacherKnowsView({
  data,
  domain,
  backHref,
  backLabel,
}: {
  data: TeacherKnowsData;
  /** Academy slug the page belongs to (used for adding a goal). */
  domain: string;
  backHref: string;
  backLabel: string;
}) {
  const teacher = data.teacherName;
  const [memories, setMemories] = useState<TeacherKnowsMemory[]>(data.memories);
  const [prefs, setPrefs] = useState<LearnerPreferences | null>(data.preferences);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [forgetId, setForgetId] = useState("");
  const [isPending, startTransition] = useTransition();

  function run<R extends MemoryActionResult | { ok: true; id: string; companyId: string }>(
    action: () => Promise<R>,
    onOk: (res: Extract<R, { ok: true }>) => void,
    success: string,
  ) {
    startTransition(async () => {
      try {
        const res = await action();
        if (res.ok) {
          onOk(res as Extract<R, { ok: true }>);
          toast.success(success);
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  function handleExport() {
    startTransition(async () => {
      const res = await exportMyLearnerData().catch(() => null);
      if (!res || !res.ok) {
        toast.error(res && !res.ok ? res.error : "Could not export. Try again.");
        return;
      }
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function savePref(patch: Partial<LearnerPreferences>) {
    const prev = prefs;
    setPrefs({ ...(prefs ?? emptyPrefs()), ...patch });
    if ("dataSaver" in patch && typeof patch.dataSaver === "boolean") {
      // Keep this device in step with the account choice (the device choice wins in resolveLite).
      try {
        window.localStorage.setItem(LITE_STORAGE_KEY, patch.dataSaver ? "1" : "0");
      } catch {
        // storage blocked: the account preference still applies on next load
      }
    }
    startTransition(async () => {
      const res = await saveMyLearnerPreferences(patch).catch(() => ({ ok: false as const, error: "Could not save." }));
      if (!res.ok) {
        setPrefs(prev);
        toast.error(res.error);
      }
    });
  }

  if (!data.available) {
    return (
      <Shell backHref={backHref} backLabel={backLabel} teacher={teacher}>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-black text-[#062e39]">Coming soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Soon you will be able to see and correct everything {teacher} remembers about you here.
          </p>
        </div>
      </Shell>
    );
  }

  const about = memories.filter((m) => m.kind === "goal" || m.kind === "background" || m.kind === "preference");
  const fromSessions = memories.filter((m) => m.kind === "episode" || m.kind === "misconception" || m.kind === "note");
  const hasGoal = memories.some((m) => m.kind === "goal" && m.status === "active");

  function renderMemory(m: TeacherKnowsMemory) {
    const hidden = m.status === "hidden";
    const editing = editingId === m.id;
    return (
      <li
        key={m.id}
        className={`rounded-2xl border bg-white p-4 shadow-sm ${hidden ? "border-dashed border-slate-300 opacity-75" : "border-slate-200"}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#fff6ee] px-2 py-0.5 text-[10px] font-bold uppercase text-[#fd5523]">
            {KIND_LABEL[m.kind]}
          </span>
          {hidden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              <EyeOff className="h-3 w-3" aria-hidden /> Hidden from {teacher}
            </span>
          )}
          <VisibilityTag visibility={m.visibility} />
        </div>

        {editing ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft;
              run(
                () => updateMemoryText(m.id, text),
                () => {
                  setMemories((all) => all.map((x) => (x.id === m.id ? { ...x, content: text.replace(/\s+/g, " ").trim() } : x)));
                  setEditingId(null);
                },
                "Saved",
              );
            }}
          >
            <label className="sr-only" htmlFor={`edit-${m.id}`}>
              Edit memory
            </label>
            <Textarea id={`edit-${m.id}`} value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-800">{m.content}</p>
        )}

        <p className="mt-1 text-xs text-slate-500">
          {SOURCE_LABEL[m.source]} {teacher}
          {m.courseTitle ? ` · ${m.courseTitle}` : ""}
          {formatDate(m.createdAt) ? ` · ${formatDate(m.createdAt)}` : ""}
        </p>

        {!editing && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(m.id);
                setDraft(m.content);
              }}
            >
              <Pencil aria-hidden /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(
                  () => setMemoryHidden(m.id, !hidden),
                  () => setMemories((all) => all.map((x) => (x.id === m.id ? { ...x, status: hidden ? "active" : "hidden" } : x))),
                  hidden ? `${teacher} can use this again` : `Hidden from ${teacher}`,
                )
              }
            >
              {hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              {hidden ? "Show again" : "This isn't right"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              disabled={isPending}
              onClick={() => {
                if (!window.confirm(`Delete this for good? ${teacher} will forget it.`)) return;
                run(() => deleteMemory(m.id), () => setMemories((all) => all.filter((x) => x.id !== m.id)), "Deleted");
              }}
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          </div>
        )}
      </li>
    );
  }

  return (
    <Shell
      backHref={backHref}
      backLabel={backLabel}
      teacher={teacher}
      action={
        <Button variant="outline" onClick={handleExport} disabled={isPending}>
          <Download aria-hidden /> Export my data
        </Button>
      }
    >
      {data.habits && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Flame className="h-5 w-5 text-[#fd5523]" aria-hidden />
          <p className="text-sm text-slate-700">
            <strong>{data.habits.streakDays}-day streak</strong> · longest {data.habits.longestStreakDays} days ·{" "}
            {data.habits.totalPracticeMinutes} min practised
          </p>
        </div>
      )}

      <Section title="About you" description={`What you told ${teacher}, and how you like to learn.`}>
        {!hasGoal && (
          <form
            className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const text = goalDraft;
              run(
                () => addLearnerGoal(domain, text),
                (saved) => {
                  setGoalDraft("");
                  setMemories((all) => [
                    {
                      id: saved.id,
                      companyId: saved.companyId,
                      kind: "goal",
                      content: text.replace(/\s+/g, " ").trim(),
                      source: "learner_stated",
                      sourceRef: null,
                      sessionId: null,
                      courseId: null,
                      objectiveKey: null,
                      confidence: 1,
                      visibleToStaff: false,
                      status: "active",
                      expiresAt: null,
                      createdAt: new Date().toISOString(),
                      courseTitle: null,
                      visibility: "private",
                    },
                    ...all,
                  ]);
                },
                `Thanks. ${teacher} will keep this in mind.`,
              );
            }}
          >
            <label htmlFor="goal" className="flex items-center gap-1.5 text-sm font-semibold text-[#062e39]">
              <Target className="h-4 w-4 text-[#fd5523]" aria-hidden />
              What brings you here? <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <Textarea
              id="goal"
              rows={2}
              maxLength={500}
              placeholder="For example: pass my exam, get a job in data, or just curious"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={isPending || !goalDraft.trim()}>
              Save goal
            </Button>
          </form>
        )}
        {about.length > 0 ? (
          <ul className="space-y-2">{about.map(renderMemory)}</ul>
        ) : hasGoal ? null : (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        )}
      </Section>

      <Section title="From your sessions" description={`What ${teacher} noticed while teaching you. Hidden items never reach ${teacher}.`}>
        {fromSessions.length > 0 ? (
          <ul className="space-y-2">{fromSessions.map(renderMemory)}</ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing yet. After a session, what {teacher} remembers appears here.</p>
        )}
      </Section>

      <Section
        title="Skills"
        description="What you have shown, objective by objective, with the evidence behind it. Your academy's teachers can see your progress."
      >
        {data.objectives.length > 0 ? (
          <ul className="space-y-2">
            {data.objectives.map((o) => (
              <ObjectiveItem key={o.objectiveKey} objective={o} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No checks recorded yet.</p>
        )}
      </Section>

      <Section title="Your settings" description="These apply everywhere you learn, on every device. Only you can see them.">
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <PrefSelect
            label="Start sessions with"
            value={prefs?.preferredMode ?? ""}
            options={[
              ["", "Let the teacher choose"],
              ["voice", "Voice"],
              ["text", "Text"],
            ]}
            onChange={(v) => savePref({ preferredMode: v === "voice" || v === "text" ? v : null })}
          />
          <PrefToggle label="Data saver" checked={prefs?.dataSaver ?? false} onChange={(v) => savePref({ dataSaver: v })} />
          <PrefToggle label="Captions" checked={prefs?.captions ?? true} onChange={(v) => savePref({ captions: v })} />
          <PrefToggle label="Reduce motion" checked={prefs?.reducedMotion ?? false} onChange={(v) => savePref({ reducedMotion: v })} />
        </div>
      </Section>

      {data.courses.length > 0 && (
        <Section title="Forget a course" description={`${teacher} deletes everything it remembers about that course. Your progress records stay.`}>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="forget-course" className="sr-only">
              Course
            </label>
            <select
              id="forget-course"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              value={forgetId}
              onChange={(e) => setForgetId(e.target.value)}
            >
              <option value="">Choose a course…</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={!forgetId || isPending}
              onClick={() => {
                const course = data.courses.find((c) => c.id === forgetId);
                if (!course || !window.confirm(`Forget everything about "${course.title}"?`)) return;
                run(
                  () => forgetCourse(course.id),
                  () => {
                    setMemories((all) => all.filter((m) => m.courseId !== course.id));
                    setForgetId("");
                  },
                  `${teacher} forgot "${course.title}"`,
                );
              }}
            >
              Forget this course
            </Button>
          </div>
        </Section>
      )}
    </Shell>
  );
}

function emptyPrefs(): LearnerPreferences {
  return { preferredMode: null, speechRate: null, captions: null, dataSaver: null, reducedMotion: null, uiLanguage: null };
}

function Shell({
  backHref,
  backLabel,
  teacher,
  action,
  children,
}: {
  backHref: string;
  backLabel: string;
  teacher: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl space-y-8 px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#fd5523]">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {backLabel}
            </Link>
            <h1 className="mt-1.5 font-heading text-2xl font-black tracking-tight text-[#062e39] sm:text-3xl">
              What {teacher} knows about you
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {teacher} remembers what helps you learn. You can correct, hide or delete anything here.
            </p>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

function ObjectiveItem({ objective }: { objective: TeacherKnowsObjective }) {
  const [open, setOpen] = useState(false);
  const label = LEVEL_LABEL[Math.max(0, Math.min(3, objective.level))];
  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{objective.objectiveText}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {label}
            {objective.courseTitle ? ` · ${objective.courseTitle}` : ""}
            {objective.lastEvidenceAt ? ` · last checked ${formatDate(objective.lastEvidenceAt)}` : ""}
          </p>
          <div className="mt-1.5">
            <VisibilityTag visibility={objective.visibility} />
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-slate-100 px-4 py-3">
          {objective.evidence.length === 0 && <li className="text-xs text-slate-500">No evidence details kept.</li>}
          {objective.evidence.map((e, i) => (
            <li key={i} className="text-xs text-slate-700">
              <span className="font-semibold">
                {e.result === "correct" ? "Correct" : e.result === "partial" ? "Partly" : "Not yet"}
              </span>
              {` · ${formatDate(e.createdAt)}`}
              {e.detail ? ` — ${e.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PrefToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm text-slate-700">
      {label}
      <input type="checkbox" className="h-4 w-4 accent-[#fd5523]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function PrefSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm text-slate-700">
      {label}
      <select className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
