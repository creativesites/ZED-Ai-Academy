import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createDemoRateLimiter,
  DEMO_MAX_HISTORY,
  DEMO_MAX_LEARNER_TURNS,
  DEMO_MAX_TEXT_CHARS,
  demoEndEvent,
  demoHistoryToTurns,
  demoLimitReason,
  demoSpeechDataUrl,
  demoWrapUpInstruction,
  isDemoEnabled,
  parseDemoHistory,
  parseDemoReport,
  parseDemoTurn,
  type DemoHistoryEntry,
} from "./demo.ts";
import { tutorEventSchema } from "./events.ts";
import { buildContents } from "./server/turn-pipeline.ts";

const L = (text: string): DemoHistoryEntry => ({ role: "learner", text });
const T = (text: string): DemoHistoryEntry => ({ role: "tutor", text });

/** Opening tutor line, then `learners` learner/tutor pairs. Mirrors what the client sends. */
function conversation(learners: number): DemoHistoryEntry[] {
  const history: DemoHistoryEntry[] = [T("Opening.")];
  for (let i = 0; i < learners; i++) history.push(L(`line ${i + 1}`), T(`reply ${i + 1}`));
  return history;
}

describe("kill switch", () => {
  it("is on unless TUTOR_DEMO_ENABLED is exactly false", () => {
    assert.equal(isDemoEnabled(undefined), true);
    assert.equal(isDemoEnabled(""), true);
    assert.equal(isDemoEnabled("true"), true);
    assert.equal(isDemoEnabled("0"), true);
    assert.equal(isDemoEnabled("false"), false);
    assert.equal(isDemoEnabled("  FALSE "), false);
  });
});

describe("parseDemoTurn", () => {
  const base = { scenarioKey: "zh-tea-house", history: [] };

  it("accepts a valid opening request", () => {
    const parsed = parseDemoTurn(base);
    assert.ok(parsed.ok);
    assert.equal(parsed.value.text, null);
    assert.equal(parsed.value.elapsedMs, 0);
    assert.deepEqual(parsed.value.history, []);
  });

  it("rejects an unknown scenario key with 400", () => {
    const parsed = parseDemoTurn({ ...base, scenarioKey: "klingon" });
    assert.deepEqual([parsed.ok, !parsed.ok && parsed.status], [false, 400]);
  });

  it("trims text and treats blank text as the opening", () => {
    const typed = parseDemoTurn({ ...base, text: "  你好  " });
    assert.ok(typed.ok);
    assert.equal(typed.value.text, "你好");
    const blank = parseDemoTurn({ ...base, text: "   " });
    assert.ok(blank.ok);
    assert.equal(blank.value.text, null);
  });

  it("caps text at 500 characters", () => {
    assert.ok(parseDemoTurn({ ...base, text: "a".repeat(DEMO_MAX_TEXT_CHARS) }).ok);
    const over = parseDemoTurn({ ...base, text: "a".repeat(DEMO_MAX_TEXT_CHARS + 1) });
    assert.deepEqual([over.ok, !over.ok && over.status], [false, 400]);
  });

  it("rejects non-string text", () => {
    assert.equal(parseDemoTurn({ ...base, text: 42 }).ok, false);
  });

  it("clamps elapsed time to a non-negative whole number and rejects non-numbers", () => {
    const negative = parseDemoTurn({ ...base, elapsedMs: -5 });
    assert.ok(negative.ok);
    assert.equal(negative.value.elapsedMs, 0);
    const fractional = parseDemoTurn({ ...base, elapsedMs: 1234.9 });
    assert.ok(fractional.ok);
    assert.equal(fractional.value.elapsedMs, 1234);
    assert.equal(parseDemoTurn({ ...base, elapsedMs: "soon" }).ok, false);
    assert.equal(parseDemoTurn({ ...base, elapsedMs: Number.NaN }).ok, false);
  });
});

describe("parseDemoHistory", () => {
  it("accepts up to 24 entries and rejects 25", () => {
    assert.ok(parseDemoHistory(conversation(11)).ok, "23 entries");
    assert.ok(parseDemoHistory(Array.from({ length: DEMO_MAX_HISTORY }, (_, i) => T(`t${i}`))).ok, "24 entries");
    const over = parseDemoHistory(Array.from({ length: DEMO_MAX_HISTORY + 1 }, (_, i) => T(`t${i}`)));
    assert.deepEqual([over.ok, !over.ok && over.status], [false, 400]);
  });

  it("rejects bad roles, empty text, non-string text and non-array input", () => {
    assert.equal(parseDemoHistory([{ role: "system", text: "x" }]).ok, false);
    assert.equal(parseDemoHistory([{ role: "learner", text: "   " }]).ok, false);
    assert.equal(parseDemoHistory([{ role: "learner", text: 3 }]).ok, false);
    assert.equal(parseDemoHistory("nope").ok, false);
    assert.equal(parseDemoHistory([null]).ok, false);
  });

  it("caps learner text at 500 and tutor text at 1000", () => {
    assert.equal(parseDemoHistory([L("a".repeat(501))]).ok, false);
    assert.equal(parseDemoHistory([T("a".repeat(1000))]).ok, true);
    assert.equal(parseDemoHistory([T("a".repeat(1001))]).ok, false);
  });

  it("treats a missing history as empty", () => {
    const parsed = parseDemoHistory(undefined);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, []);
  });
});

describe("parseDemoReport", () => {
  it("refuses a report with no learner speech (422)", () => {
    const parsed = parseDemoReport({ scenarioKey: "es-cafe", history: [T("Hola")] });
    assert.deepEqual([parsed.ok, !parsed.ok && parsed.status], [false, 422]);
  });

  it("accepts a report once the learner has spoken", () => {
    const parsed = parseDemoReport({ scenarioKey: "es-cafe", history: [T("Hola"), L("Hola")] });
    assert.ok(parsed.ok);
    assert.equal(parsed.value.scenarioKey, "es-cafe");
  });
});

describe("demo limits", () => {
  it("ends on the time box once the scenario minutes have passed", () => {
    assert.equal(demoLimitReason({ history: [], learnerTurn: true, elapsedMs: 5 * 60_000, maxMinutes: 6 }), null);
    assert.equal(demoLimitReason({ history: [], learnerTurn: true, elapsedMs: 6 * 60_000, maxMinutes: 6 }), "time_box");
  });

  it("allows the 12th learner turn (23 entries) and wraps up on it", () => {
    const beforeTwelfth = conversation(DEMO_MAX_LEARNER_TURNS - 1);
    assert.equal(beforeTwelfth.length, 23);
    assert.equal(parseDemoHistory(beforeTwelfth).ok, true);
    assert.equal(demoLimitReason({ history: beforeTwelfth, learnerTurn: true, elapsedMs: 0, maxMinutes: 6 }), null);
    assert.match(demoWrapUpInstruction({ history: beforeTwelfth, learnerTurn: true }) ?? "", /last learner turn/);
  });

  it("cannot carry 12 learner replies in the history, so the 13th turn never gets a model call", () => {
    // After the 12th reply the client holds 25 entries, which the 24-entry cap refuses.
    assert.equal(parseDemoHistory(conversation(DEMO_MAX_LEARNER_TURNS)).ok, false);
    // A shorter history with 12 learner lines still hits the turn cap in the limit check.
    const twelveLearners = Array.from({ length: DEMO_MAX_LEARNER_TURNS }, (_, i) => L(`line ${i}`));
    assert.equal(demoLimitReason({ history: twelveLearners, learnerTurn: true, elapsedMs: 0, maxMinutes: 6 }), "turn_limit");
  });

  it("never ends the opening turn on the turn cap", () => {
    assert.equal(demoLimitReason({ history: conversation(DEMO_MAX_LEARNER_TURNS), learnerTurn: false, elapsedMs: 0, maxMinutes: 6 }), null);
  });

  it("tells the model to wrap up on the last allowed learner turn only", () => {
    assert.equal(demoWrapUpInstruction({ history: conversation(10), learnerTurn: true }), null);
    assert.match(demoWrapUpInstruction({ history: conversation(11), learnerTurn: true }) ?? "", /last learner turn/);
    assert.equal(demoWrapUpInstruction({ history: conversation(11), learnerTurn: false }), null);
  });

  it("builds valid end_session events for each limit", () => {
    for (const reason of ["time_box", "turn_limit"] as const) {
      assert.ok(tutorEventSchema.safeParse(demoEndEvent(reason)).success);
    }
  });
});

describe("demoHistoryToTurns", () => {
  it("pairs each learner line with the teacher's reply and keeps the opening", () => {
    const turns = demoHistoryToTurns([T("Hello!"), L("Hi"), T("Good."), L("Bye")]);
    assert.deepEqual(
      turns.map((t) => t.idx),
      [0, 1, 2],
    );
    assert.equal(turns[0].learner_text, null);
    assert.deepEqual(turns[0].events, [{ type: "say", text: "Hello!" }]);
    assert.equal(turns[1].learner_text, "Hi");
    assert.deepEqual(turns[1].events, [{ type: "say", text: "Good." }]);
    assert.equal(turns[2].learner_text, "Bye");
    assert.deepEqual(turns[2].events, []);
  });

  it("keeps consecutive learner lines as separate turns", () => {
    const turns = demoHistoryToTurns([L("one"), L("two")]);
    assert.equal(turns.length, 2);
    assert.deepEqual(turns[0].events, []);
  });

  it("produces the same model contents the real pipeline builds", () => {
    const contents = buildContents(demoHistoryToTurns([T("Hello!"), L("Hi"), T("Good.")]), "Bye", "open");
    assert.deepEqual(
      contents.map((c) => c.role),
      ["user", "model", "user", "model", "user"],
    );
    assert.equal(contents[0].parts[0].text, "(session opening)");
    assert.equal(contents[contents.length - 1].parts[0].text, "Learner: Bye");
  });
});

describe("createDemoRateLimiter", () => {
  it("allows the limit within the window, then refuses with a retry time", () => {
    let now = 0;
    const limiter = createDemoRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });
    assert.deepEqual(limiter.take("u1"), { ok: true, remaining: 1 });
    assert.deepEqual(limiter.take("u1"), { ok: true, remaining: 0 });
    now = 4_000;
    assert.deepEqual(limiter.take("u1"), { ok: false, retryAfterSec: 6 });
  });

  it("frees a slot once its hit leaves the window", () => {
    let now = 0;
    const limiter = createDemoRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    assert.equal(limiter.take("u").ok, true);
    assert.equal(limiter.take("u").ok, false);
    now = 1_000;
    assert.equal(limiter.take("u").ok, true);
  });

  it("counts each key separately", () => {
    const limiter = createDemoRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    assert.equal(limiter.take("a").ok, true);
    assert.equal(limiter.take("b").ok, true);
    assert.equal(limiter.take("a").ok, false);
  });

  it("allows the showcase budget of 40 calls per hour and refuses the 41st", () => {
    const limiter = createDemoRateLimiter({ limit: 40, windowMs: 3_600_000, now: () => 0 });
    for (let i = 0; i < 40; i++) assert.equal(limiter.take("u").ok, true, `call ${i + 1}`);
    assert.equal(limiter.take("u").ok, false);
  });
});

describe("demoSpeechDataUrl", () => {
  it("returns an inline WAV data URL that decodes to the same bytes", () => {
    const wav = Uint8Array.from([82, 73, 70, 70]);
    const url = demoSpeechDataUrl(wav);
    assert.ok(url.startsWith("data:audio/wav;base64,"));
    const decoded = Buffer.from(url.slice("data:audio/wav;base64,".length), "base64");
    assert.deepEqual([...decoded], [...wav]);
  });
});
