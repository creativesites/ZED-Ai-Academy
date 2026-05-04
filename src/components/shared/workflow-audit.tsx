"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock3, Sparkles, Target } from "lucide-react";

const ROLE_OPTIONS = ["Operations", "Marketing", "Consulting", "Leadership"] as const;
const TASK_OPTIONS = [
  "Reporting and analysis",
  "Writing and review",
  "Meetings and follow-up",
  "Research and synthesis",
] as const;
const OUTCOME_OPTIONS = ["Save time", "Improve quality", "Standardize work", "Scale output"] as const;

const RECOMMENDATIONS = {
  "Operations:Save time": {
    title: "AI workflow automation",
    body: "Start with AI Tools and AI for Business to remove recurring reporting and handoff work.",
  },
  "Marketing:Scale output": {
    title: "Campaign acceleration",
    body: "Prompt Engineering and AI for Business will help you ship more campaigns without dropping quality.",
  },
  "Consulting:Improve quality": {
    title: "Client-ready synthesis",
    body: "Prompt Engineering gives you better research prompts, cleaner structure, and faster review cycles.",
  },
  "Leadership:Standardize work": {
    title: "Team operating system",
    body: "AI for Business is the best fit if you want repeatable workflows, governance, and measurable ROI.",
  },
  default: {
    title: "Practical AI fundamentals",
    body: "Begin with the quick-win lesson structure, then move into a workflow course aligned to your role.",
  },
} as const;

export function WorkflowAudit() {
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("Operations");
  const [task, setTask] = useState<(typeof TASK_OPTIONS)[number]>("Reporting and analysis");
  const [outcome, setOutcome] = useState<(typeof OUTCOME_OPTIONS)[number]>("Save time");
  const [minutes, setMinutes] = useState("120");

  const key = `${role}:${outcome}` as keyof typeof RECOMMENDATIONS;
  const recommendation = RECOMMENDATIONS[key] ?? RECOMMENDATIONS.default;
  const timeSaved = Math.max(Math.round(Number(minutes || "0") * 0.35), 15);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
          <Target className="mr-1 h-3 w-3" />
          Workflow Audit
        </Badge>
        <p className="text-sm text-slate-600">Five-minute diagnostic for practical professionals.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm font-medium text-slate-900">
            Your role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as (typeof ROLE_OPTIONS)[number])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-0"
            >
              {ROLE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-900">
            Repetitive task
            <select
              value={task}
              onChange={(event) => setTask(event.target.value as (typeof TASK_OPTIONS)[number])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-0"
            >
              {TASK_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-900">
            Main goal
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as (typeof OUTCOME_OPTIONS)[number])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-0"
            >
              {OUTCOME_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Recommended next move
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{recommendation.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{recommendation.body}</p>

          <label className="mt-4 block space-y-2 text-sm font-medium text-slate-900">
            Current time spent per week (minutes)
            <input
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              type="number"
              min="15"
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-0"
            />
          </label>

          <div className="mt-4 rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Expected quick win
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{timeSaved} mins</p>
            <p className="text-sm text-slate-600">Estimated weekly time reclaimed after the first workflow upgrade.</p>
          </div>

          <Button className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-500">
            Use this recommendation
          </Button>
        </div>
      </div>
    </div>
  );
}
