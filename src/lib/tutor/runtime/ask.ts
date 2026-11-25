import { tutorEventSchema, toClientEvent, type TutorEvent } from "../contract/index.ts";
import { boardFromEvent, choiceReply, revealBoard, type BoardState } from "../board.ts";
import { DEBUG_RAW_OUTPUT_TYPE, sessionLimitReason } from "../server/turn-pipeline.ts";

// The lesson "Ask" dock on the Teacher Runtime (P1-06, Architecture §3.1 `ask` origin). Pure rules shared by the
// server (session scenario, resume rule, stored turns → client turns) and the dock (board state, quick actions,
// legacy `:::directive:::` mapping). No I/O, so node:test runs it.

/** Feature flag value of NEXT_PUBLIC_TEACHER_ASK_RUNTIME. Default off. */
export function isAskRuntimeEnabled(value: string | undefined | null): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * An `ask` session stays open for a week of on-and-off questions; MAX_TURNS still caps one conversation. When either
 * runs out the next open starts a fresh conversation (the old one stays in the learner's history).
 */
export const ASK_MAX_MINUTES = 7 * 24 * 60;

/** Teaching moves the learner can ask for in one tap (dock starter cards and chips). Same for every subject. */
export const ASK_QUICK_ACTIONS = [
  { label: "Explain simpler", body: "Explain the main idea of this lesson more simply, with one everyday example." },
  { label: "Give me an example", body: "Give me a real, local example of how this lesson applies at work or in a small business." },
  { label: "Quiz me", body: "Ask me one question at a time to check I understood this lesson. Wait for my answer before the next one." },
  { label: "Summarise", body: "Summarise this lesson in five short bullet points I can review later." },
] as const;

export type AskLessonBlock = { id: string; type: string; title?: string | null };

const MAX_BLOCK_REFS = 40;

/** A title from course content, made safe to list in the prompt: one line, no quotes or markup, at most 80 chars. */
export function safeBlockTitle(title: unknown): string {
  if (typeof title !== "string") return "";
  return title
    .replace(/[\u0000-\u001f\u007f"`<>{}[\]\\]/g, " ")
    .replace(/:::/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The synthetic scenario an `ask` session runs (no authored flow): title, goal and the role notes that tell the
 * teacher how the dock works. Lesson content itself reaches the prompt through the normal lesson layer.
 */
export function buildAskScenario(input: {
  lessonTitle: string | null;
  courseTitle: string | null;
  blocks: readonly AskLessonBlock[];
}): { title: string; goal: string; roleNotes: string } {
  const lesson = safeBlockTitle(input.lessonTitle) || "this lesson";
  const course = safeBlockTitle(input.courseTitle);
  const refs = input.blocks
    .filter((b) => UUID.test(b.id) && (b.type === "video" || b.type === "text" || b.type === "quiz"))
    .slice(0, MAX_BLOCK_REFS)
    .map((b) => {
      const title = safeBlockTitle(b.title);
      return `- blockId=${b.id} type=${b.type}${title ? ` (${title})` : ""}`;
    });

  const roleNotes = [
    "This is the lesson's Ask panel, not a scripted flow: the learner asks questions about the lesson whenever they like, often days apart.",
    "Answer what they asked, grounded in the lesson content. Speak in say events (two to five short sentences is fine when they asked for an explanation); never write markdown tables or :::directive::: markup, use events instead.",
    "Put lists, steps, worked examples, code and comparisons on the board with show_board. When the lesson covers it, point back with show_lesson_ref (use a blockId from the list below and, for a video, seconds).",
    'When the learner asks to be quizzed, ask ONE ask_choice question at a time. After their reply ("I choose: ..."), give short feedback, then record note_evidence with the lesson idea as the objective.',
    "There are no steps to advance and no time pressure: do not use advance_step or end_session.",
    refs.length ? `Lesson blocks you can point to:\n${refs.join("\n")}` : "This lesson has no blocks to point to.",
  ].join("\n");

  return {
    title: `Ask about ${lesson}`.slice(0, 160),
    goal: `Help the learner understand and apply ${lesson}${course ? ` (course: ${course})` : ""}: answer their questions, check understanding when they ask, and point back to the lesson.`,
    roleNotes,
  };
}

export type AskSessionFacts = { status: string; startedAtMs: number; companyId: string };

/**
 * Whether the dock resumes the learner's open `ask` session or starts a new one: a new one when there is none, the
 * learner asked to start over, it ran past its time box or turn cap, or the course now belongs to another tenant.
 */
export function askResumeDecision(input: {
  session: AskSessionFacts | null;
  turnCount: number;
  nowMs: number;
  tenantId: string;
  restart?: boolean;
}): "resume" | "create" | "end_and_create" {
  const { session } = input;
  if (!session || session.status !== "active") return "create";
  if (input.restart) return "end_and_create";
  if (session.companyId !== input.tenantId) return "end_and_create";
  const limit = sessionLimitReason({
    idx: input.turnCount,
    sessionStartedAtMs: session.startedAtMs,
    maxMinutes: ASK_MAX_MINUTES,
    nowMs: input.nowMs,
  });
  return limit ? "end_and_create" : "resume";
}

export type AskClientTurn = { idx: number; learnerText: string | null; events: TutorEvent[] };

/**
 * Stored `tutor_turns` rows as the dock may see them: debug entries removed, every event re-validated against the
 * contract (stored rows predate later changes) and stripped of server-only fields.
 */
export function clientTurnsFromRows(rows: ReadonlyArray<{ idx: number; learner_text: string | null; events: unknown }>): AskClientTurn[] {
  return [...rows]
    .sort((a, b) => a.idx - b.idx)
    .map((row) => {
      const events: TutorEvent[] = [];
      if (Array.isArray(row.events)) {
        for (const raw of row.events) {
          if (raw && typeof raw === "object" && (raw as { type?: unknown }).type === DEBUG_RAW_OUTPUT_TYPE) continue;
          const parsed = tutorEventSchema.safeParse(raw);
          if (parsed.success) events.push(toClientEvent(parsed.data));
        }
      }
      return { idx: row.idx, learnerText: row.learner_text, events };
    });
}

// ---- Dock thread state ----

export type AskThreadMessage = { role: "user"; text: string } | { role: "assistant"; events: readonly TutorEvent[] };

type LessonRef = Extract<TutorEvent, { type: "show_lesson_ref" }>;
type Clip = Extract<TutorEvent, { type: "play_clip" }>;

export type AskBoardState = {
  board: BoardState | null;
  /** Jump chips from the latest teacher message that had any. */
  lessonRefs: LessonRef[];
  clip: Clip | null;
  /** Award from the latest teacher message only. */
  award: { title: string; detail?: string } | null;
  /** The last teacher message's question, while the learner has not answered it. */
  openChoice: { messageIndex: number; question: string; options: string[] } | null;
  openConfidence: { messageIndex: number; prompt?: string } | null;
  /** Options picked per question, keyed `${messageIndex}:${question}`. */
  picked: Record<string, string>;
};

/** The pinned board and open interactions, derived from the whole thread (so it is the same after a reload). */
export function deriveAskBoard(messages: readonly AskThreadMessage[]): AskBoardState {
  let board: BoardState | null = null;
  let lessonRefs: LessonRef[] = [];
  let clip: Clip | null = null;
  let award: AskBoardState["award"] = null;
  const picked: Record<string, string> = {};

  let lastAssistant = -1;
  messages.forEach((msg, i) => {
    if (msg.role !== "assistant") return;
    lastAssistant = i;
    const refs: LessonRef[] = [];
    award = null;
    for (const ev of msg.events) {
      if (ev.type === "show_board") board = boardFromEvent(ev);
      else if (ev.type === "reveal_step" && board) board = revealBoard(board, ev.index);
      else if (ev.type === "show_lesson_ref") refs.push(ev);
      else if (ev.type === "play_clip") clip = ev;
      else if (ev.type === "award") award = { title: ev.title, ...(ev.detail ? { detail: ev.detail } : {}) };
      else if (ev.type === "ask_choice") {
        const next = messages[i + 1];
        if (next?.role === "user") {
          const option = ev.options.find((o) => choiceReply(o) === next.text);
          if (option) picked[`${i}:${ev.question}`] = option;
        }
      }
    }
    if (refs.length) lessonRefs = refs;
  });

  let openChoice: AskBoardState["openChoice"] = null;
  let openConfidence: AskBoardState["openConfidence"] = null;
  if (lastAssistant >= 0 && lastAssistant === messages.length - 1) {
    const events = (messages[lastAssistant] as { events: readonly TutorEvent[] }).events;
    for (const ev of events) {
      if (ev.type === "ask_choice") openChoice = { messageIndex: lastAssistant, question: ev.question, options: [...ev.options] };
      if (ev.type === "ask_confidence") openConfidence = { messageIndex: lastAssistant, ...(ev.prompt ? { prompt: ev.prompt } : {}) };
    }
  }

  return { board, lessonRefs, clip, award, openChoice, openConfidence, picked };
}

/** What the teacher said in a message, for Listen and Copy. */
export function askSpokenText(events: readonly TutorEvent[]): string {
  return events
    .filter((e): e is Extract<TutorEvent, { type: "say" }> => e.type === "say")
    .map((e) => e.text.trim())
    .filter(Boolean)
    .join(" ");
}

/** "Recorded: 1 of 2 correct" — the teacher's judgement on checks in one message (UX §4.2). Null when none. */
export function askEvidenceSummary(events: readonly TutorEvent[]): {
  correct: number;
  total: number;
  line: string;
  details: { objective: string; result: string; detail?: string }[];
} | null {
  const evidence = events.filter((e): e is Extract<TutorEvent, { type: "note_evidence" }> => e.type === "note_evidence");
  if (evidence.length === 0) return null;
  const correct = evidence.filter((e) => e.result === "correct").length;
  return {
    correct,
    total: evidence.length,
    line: `Recorded: ${correct} of ${evidence.length} correct`,
    details: evidence.map((e) => ({ objective: e.objective, result: e.result, ...(e.detail ? { detail: e.detail } : {}) })),
  };
}

// ---- Legacy dock directives → contract events ----

/**
 * How each `:::directive:::` widget of the legacy dock (/api/ai/tutor) maps onto contract v2 events. The runtime
 * prompt asks for events, but models trained on the old prompt (and stored history) may still write directives into
 * a `say` line; `expandLegacyDirectives` converts them so nothing renders as raw markup.
 */
export const LEGACY_DIRECTIVE_MAP: Readonly<Record<string, string>> = {
  board: "show_board (same kind/title/items/text)",
  lesson_ref: "show_lesson_ref (label, blockId, seconds)",
  knowledge_check: "ask_choice (question, options; correctIndex dropped until server grading, P2-04)",
  workflow_steps: "show_board kind=steps (items = 'title: description')",
  checklist: "show_board kind=bullets (title, items)",
  comparison_table: "show_board kind=table (rows = [headers, ...rows]; caption → title)",
  code_snippet: "show_board kind=code (text = code, language, title)",
  prompt_template: "show_board kind=note (title, text = prompt; description dropped)",
  prompt_iteration: "show_board kind=compare (rows = [[labelBefore, labelAfter], [before, after]]; reasoning dropped)",
  tool_spotlight: "show_board kind=note (title = name, text = description + url)",
  resource_link: "show_board kind=note (title, text = description + url)",
  action_card: "show_board kind=note (title, text = description); the action button is dropped",
  course_card: "show_board kind=note (title, text = description); the course link is dropped",
};

const DIRECTIVE = /:::([a-z_]+)\s*([\s\S]*?)\s*:::/g;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t.slice(0, max) : undefined;
}

function strList(value: unknown, max: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, max))
    .filter((v): v is string => v !== undefined)
    .slice(0, maxItems);
}

function note(title: unknown, ...parts: unknown[]): Record<string, unknown> {
  const text = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
  return { type: "show_board", kind: "note", title: str(title, 120), text: text || str(title, 1200) };
}

function directiveToEvent(name: string, props: Record<string, unknown>): Record<string, unknown> | null {
  switch (name) {
    case "board":
      return {
        type: "show_board",
        kind: props.kind,
        title: str(props.title, 120),
        items: Array.isArray(props.items) ? strList(props.items, 240, 8) : undefined,
        text: str(props.text ?? props.body, 1200),
      };
    case "lesson_ref":
      return {
        type: "show_lesson_ref",
        label: str(props.label, 160) ?? "Lesson reference",
        blockId: str(props.blockId, 64),
        seconds: typeof props.seconds === "number" && props.seconds >= 0 ? Math.floor(props.seconds) : undefined,
      };
    case "knowledge_check":
      return { type: "ask_choice", question: str(props.question, 240), options: strList(props.options, 160, 5) };
    case "workflow_steps": {
      const steps = Array.isArray(props.steps) ? props.steps : [];
      const items = steps
        .map((s) => {
          const step = (s ?? {}) as Record<string, unknown>;
          const title = str(step.title, 240);
          const description = str(step.description, 240);
          return title && description ? `${title}: ${description}`.slice(0, 240) : (title ?? description);
        })
        .filter((v): v is string => v !== undefined)
        .slice(0, 8);
      return { type: "show_board", kind: "steps", items };
    }
    case "checklist":
      return { type: "show_board", kind: "bullets", title: str(props.title, 120), items: strList(props.items, 240, 8) };
    case "comparison_table": {
      const header = strList(props.headers, 120, 5);
      const rows = (Array.isArray(props.rows) ? props.rows : []).map((r) => strList(r, 120, 5)).filter((r) => r.length);
      return {
        type: "show_board",
        kind: "table",
        title: str(props.caption, 120),
        rows: [...(header.length ? [header] : []), ...rows].slice(0, 8),
      };
    }
    case "code_snippet":
      return { type: "show_board", kind: "code", title: str(props.title, 120), text: str(props.code, 1200), language: str(props.language, 24) };
    case "prompt_template":
      return note(props.title ?? "Prompt", props.prompt);
    case "prompt_iteration": {
      const before = str(props.before, 120);
      const after = str(props.after, 120);
      if (!before || !after) return null;
      return {
        type: "show_board",
        kind: "compare",
        rows: [[str(props.labelBefore, 120) ?? "Original", str(props.labelAfter, 120) ?? "Improved"], [before, after]],
      };
    }
    case "tool_spotlight":
      return note(props.name, props.description, props.url);
    case "resource_link":
      return note(props.title, props.description, props.url);
    case "action_card":
    case "course_card":
      return note(props.title, props.description);
    default:
      return null;
  }
}

/**
 * Replaces legacy `:::directive {json}:::` markup inside `say`/`show_text` lines with the equivalent contract events
 * (see LEGACY_DIRECTIVE_MAP). The line keeps its remaining text; invalid or unknown directives are removed.
 */
export function expandLegacyDirectives(events: readonly TutorEvent[]): TutorEvent[] {
  const out: TutorEvent[] = [];
  for (const event of events) {
    if ((event.type !== "say" && event.type !== "show_text") || !event.text.includes(":::")) {
      out.push(event);
      continue;
    }
    const extra: TutorEvent[] = [];
    const text = event.text
      .replace(DIRECTIVE, (_match, name: string, body: string) => {
        let props: Record<string, unknown>;
        try {
          props = JSON.parse(body.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Record<string, unknown>;
        } catch {
          return " ";
        }
        const mapped = props && typeof props === "object" ? directiveToEvent(name, props) : null;
        const parsed = mapped ? tutorEventSchema.safeParse(dropUndefined(mapped)) : null;
        if (parsed?.success) extra.push(parsed.data);
        return " ";
      })
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (text) out.push({ ...event, text });
    out.push(...extra);
  }
  return out;
}

function dropUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
