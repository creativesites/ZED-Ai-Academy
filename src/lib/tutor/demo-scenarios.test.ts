import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_MAX_MINUTES, DEMO_SCENARIOS, DEMO_SCENARIO_KEYS, DEMO_SCENES, demoScenario } from "./demo-scenarios.ts";
import { parseTutorTurn, tutorEventSchema } from "./events.ts";
import { tutorReportSchema } from "./report-model.ts";

describe("demo scenarios", () => {
  it("has the four showcase scenarios, one per key, in the declared order", () => {
    assert.deepEqual(
      DEMO_SCENARIOS.map((s) => s.key),
      [...DEMO_SCENARIO_KEYS],
    );
    assert.equal(new Set(DEMO_SCENARIO_KEYS).size, DEMO_SCENARIO_KEYS.length);
    assert.equal(demoScenario("zh-tea-house")?.scene, "Scene_TeaHouse");
    assert.equal(demoScenario("unknown"), undefined);
  });

  it("uses the Rive scene names and the time box", () => {
    assert.deepEqual(
      DEMO_SCENARIOS.map((s) => s.scene).sort(),
      [...DEMO_SCENES].sort(),
    );
    for (const s of DEMO_SCENARIOS) {
      assert.ok(s.maxMinutes <= DEMO_MAX_MINUTES, `${s.key} exceeds ${DEMO_MAX_MINUTES} minutes`);
      assert.deepEqual([...s.allowedModes].sort(), ["text", "voice"], `${s.key} modes`);
    }
  });

  it("has a title, goal, level, persona and beats for every scenario", () => {
    for (const s of DEMO_SCENARIOS) {
      assert.ok(s.title.trim(), `${s.key} title`);
      assert.ok(s.goal.trim(), `${s.key} goal`);
      assert.ok(s.level.trim(), `${s.key} level`);
      assert.ok(s.persona.name && s.persona.voiceName && s.persona.personalityPrompt, `${s.key} persona`);
      assert.ok(s.beats.length >= 2, `${s.key} beats`);
      assert.ok(s.targetItems.length >= 3, `${s.key} target items`);
    }
  });

  it("gives the Mandarin scenario its target items and tone work", () => {
    const zh = demoScenario("zh-tea-house");
    assert.ok(zh);
    const texts = zh.targetItems.map((t) => t.text);
    for (const word of ["你好", "请", "茶", "两杯", "谢谢"]) assert.ok(texts.includes(word), `missing ${word}`);
    assert.equal(zh.language, "zh");
    assert.ok(zh.skillPack === "language-zh");
  });

  it("marks the health scenario as a training simulation without medical advice", () => {
    const health = demoScenario("health-intake");
    assert.ok(health);
    assert.match(health.roleNotes ?? "", /training simulation/i);
    assert.match(health.roleNotes ?? "", /Do not give medical advice/);
  });

  describe("scripted sequences", () => {
    for (const s of DEMO_SCENARIOS) {
      it(`${s.key}: opening plus 3 or 4 turns, one learner line per turn`, () => {
        const { turns, learnerLines } = s.scripted;
        assert.ok(turns.length >= 4 && turns.length <= 5, `turn count ${turns.length}`);
        assert.equal(learnerLines.length, turns.length);
        assert.equal(learnerLines[0], null, "the opening has no learner line");
        for (const line of learnerLines.slice(1)) {
          assert.equal(typeof line, "string");
          assert.ok((line as string).trim().length > 0);
        }
      });

      it(`${s.key}: every turn parses with parseTutorTurn and drops nothing`, () => {
        for (const [i, events] of s.scripted.turns.entries()) {
          const parsed = parseTutorTurn({ events });
          assert.ok(parsed.ok, `turn ${i}: ${parsed.ok ? "" : parsed.error}`);
          assert.equal(parsed.dropped, 0, `turn ${i} dropped events`);
          assert.equal(parsed.events.length, events.length, `turn ${i} event count`);
          assert.ok(events.length <= 12, `turn ${i} exceeds the event cap`);
        }
      });

      it(`${s.key}: ends with end_session, and only the last turn ends`, () => {
        const { turns } = s.scripted;
        const last = turns[turns.length - 1];
        assert.ok(last.some((e) => e.type === "end_session"), "last turn ends the session");
        for (const turn of turns.slice(0, -1)) {
          assert.ok(!turn.some((e) => e.type === "end_session"), "an early turn ends the session");
        }
      });

      it(`${s.key}: has gestures, moods and a listen prompt`, () => {
        const all = s.scripted.turns.flat();
        assert.ok(all.some((e) => e.type === "gesture"), "gesture");
        assert.ok(all.some((e) => e.type === "mood"), "mood");
        assert.ok(all.some((e) => e.type === "listen"), "listen");
        assert.ok(all.some((e) => e.type === "say"), "say");
      });

      it(`${s.key}: has a canned report that matches the report schema`, () => {
        const parsed = tutorReportSchema.safeParse(s.scriptedReport);
        assert.ok(parsed.success, parsed.success ? "" : parsed.error.message);
      });
    }

    it("zh: shows cards, traces tones and writes the sandhi lesson", () => {
      const all = demoScenario("zh-tea-house")!.scripted.turns.flat();
      assert.ok(all.some((e) => e.type === "show_card"));
      assert.ok(all.some((e) => e.type === "trace_tone"));
      assert.ok(all.some((e) => e.type === "say" && e.text.includes("ní hǎo")));
    });

    it("keeps every scripted event within the shared event schema", () => {
      for (const s of DEMO_SCENARIOS) {
        for (const event of s.scripted.turns.flat()) {
          assert.ok(tutorEventSchema.safeParse(event).success, `${s.key} ${event.type}`);
        }
      }
    });
  });
});
