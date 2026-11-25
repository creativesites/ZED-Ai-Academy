import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseModelJson } from "../json.ts";
import {
  normalizeTutorScenario,
  quizQuestionCount,
  validCourseBlueprint,
  validCurriculum,
  validLessonBlocks,
  validQuizQuestions,
} from "./parse.ts";
import {
  BRAND_KIT_SCHEMA,
  COURSE_BLUEPRINT_SCHEMA,
  COURSE_REVIEW_SCHEMA,
  CURRICULUM_SCHEMA,
  ENHANCED_COPY_SCHEMA,
  PRACTICE_EXERCISE_SCHEMA,
  PRACTICE_SCORE_SCHEMA,
  QUIZ_QUESTIONS_SCHEMA,
  STUDY_PACK_SCHEMA,
  tutorScenarioSchema,
} from "./schemas.ts";

// Fixture replies modelled on real Gemini output for each route (reply text → what the route returns).
const QUIZ_REPLY = `[
  {"question":"What does RAG add to a prompt?","options":["Retrieved context","More tokens","A new model","Images"],"correct_indices":[0],"explanation":"RAG retrieves relevant text and adds it to the prompt."},
  {"question":"Which is a hallucination?","options":["A cited fact","An invented citation","A summary","A refusal"],"correct_indices":[1],"explanation":"Invented citations are hallucinations."}
]`;
const CURRICULUM_REPLY = '```json\n{"modules":[{"title":"Quick wins with ChatGPT","lessons":[{"title":"Write prompts that get usable output"}]}]}\n```';
const BLUEPRINT_REPLY = JSON.stringify({
  title: "AI for Small Business Owners",
  description: "Use AI to save hours each week. Build three workflows you will keep using.",
  category: "AI for Business",
  level: "beginner",
  price_type: "one_time",
  audience: "Owners of small shops in Lusaka",
  quick_win: "Draft a week of social posts in 10 minutes",
  capstone: "An AI-assisted customer FAQ",
  module_outline: ["Quick win", "Frameworks", "Workflow build", "Quality control"],
});
const LESSON_REPLY = 'Here you go:\n{"blocks":[{"type":"text","content":{"html":"<p>Hello {name}</p>"}},{"type":"key_takeaway","content":{"title":"Key Takeaways","points":["One"]}}]}';
const SCENARIO_REPLY = '{"title":"At the tea house","goal":"Order tea politely.","max_minutes":45.4,"scene":"Scene_Unknown","beats":[{"id":"beat-1","goal":"Greet"}],"target_items":[{"text":"你好","pron":"nǐ hǎo"}]}';

describe("generation reply fixtures", () => {
  it("quiz: accepts well-formed questions", () => {
    const questions = validQuizQuestions(parseModelJson(QUIZ_REPLY, "array"));
    assert.ok(questions);
    assert.deepEqual(questions.map((q) => q.correct_indices), [[0], [1]]);
  });

  it("quiz: rejects questions without 4 options or a correct index", () => {
    assert.equal(validQuizQuestions([{ question: "Q", options: ["a", "b"], correct_indices: [0] }]), null);
    assert.equal(validQuizQuestions([{ question: "Q", options: ["a", "b", "c", "d"], correct_indices: [] }]), null);
    assert.equal(validQuizQuestions({ questions: [] }), null);
    assert.equal(validQuizQuestions([null]), null);
  });

  it("quiz: clamps the requested count", () => {
    assert.equal(quizQuestionCount(undefined), 3);
    assert.equal(quizQuestionCount(3), 3);
    assert.equal(quizQuestionCount("5"), 5);
    assert.equal(quizQuestionCount(500), 10);
    assert.equal(quizQuestionCount(0), 1);
  });

  it("curriculum: accepts fenced JSON with modules, rejects empty", () => {
    assert.deepEqual(validCurriculum(parseModelJson(CURRICULUM_REPLY)), {
      modules: [{ title: "Quick wins with ChatGPT", lessons: [{ title: "Write prompts that get usable output" }] }],
    });
    assert.equal(validCurriculum({ modules: [] }), null);
    assert.equal(validCurriculum({}), null);
  });

  it("blueprint: passes a complete blueprint through unchanged", () => {
    const parsed = parseModelJson(BLUEPRINT_REPLY);
    assert.deepEqual(validCourseBlueprint(parsed), JSON.parse(BLUEPRINT_REPLY));
  });

  it("blueprint: rejects a missing field", () => {
    const partial = { ...JSON.parse(BLUEPRINT_REPLY), capstone: "" };
    assert.equal(validCourseBlueprint(partial), null);
  });

  it("lesson content: extracts blocks from prose-wrapped JSON", () => {
    const blocks = validLessonBlocks(parseModelJson(LESSON_REPLY));
    assert.equal(blocks?.length, 2);
    assert.equal(validLessonBlocks({ blocks: [] }), null);
  });

  it("tutor scenario: normalises unknown scene and out-of-range minutes", () => {
    const scenario = normalizeTutorScenario(parseModelJson(SCENARIO_REPLY) as Record<string, unknown>, {
      level: "A1",
      scenes: ["Scene_TeaHouse", "Scene_Classroom"],
    });
    assert.deepEqual(scenario, {
      title: "At the tea house",
      goal: "Order tea politely.",
      level: "A1",
      max_minutes: 30,
      scene: "Scene_TeaHouse",
      beats: [{ id: "beat-1", goal: "Greet" }],
      target_items: [{ text: "你好", pron: "nǐ hǎo" }],
    });
  });

  it("tutor scenario: fills defaults for an empty object", () => {
    const scenario = normalizeTutorScenario({}, { level: "B1", scenes: ["Scene_Classroom"] });
    assert.equal(scenario.title, "Speaking practice");
    assert.equal(scenario.level, "B1");
    assert.equal(scenario.max_minutes, 6);
    assert.deepEqual(scenario.beats, []);
  });
});

/** Walks a schema and returns every keyword used, to keep schemas inside the subset Gemini accepts. */
function keywords(schema: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(schema)) {
    for (const item of schema) keywords(item, out);
  } else if (schema && typeof schema === "object") {
    for (const [key, value] of Object.entries(schema)) {
      out.add(key);
      if (key === "properties") {
        for (const sub of Object.values(value as Record<string, unknown>)) keywords(sub, out);
      } else if (key === "items") {
        keywords(value, out);
      }
    }
  }
  return out;
}

describe("generation schemas", () => {
  const ALLOWED = new Set(["type", "properties", "required", "items", "enum", "description"]);
  const schemas = {
    QUIZ_QUESTIONS_SCHEMA,
    CURRICULUM_SCHEMA,
    PRACTICE_EXERCISE_SCHEMA,
    COURSE_BLUEPRINT_SCHEMA,
    COURSE_REVIEW_SCHEMA,
    BRAND_KIT_SCHEMA,
    ENHANCED_COPY_SCHEMA,
    STUDY_PACK_SCHEMA,
    PRACTICE_SCORE_SCHEMA,
    tutorScenario: tutorScenarioSchema(["Scene_A"]),
  };
  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} uses only flat, bound-free keywords`, () => {
      for (const keyword of keywords(schema)) assert.ok(ALLOWED.has(keyword), `${name} uses ${keyword}`);
    });
    it(`${name} lists only declared properties as required`, () => {
      const check = (s: Record<string, unknown>) => {
        if (s.type === "object") {
          const props = Object.keys((s.properties as Record<string, unknown>) ?? {});
          for (const r of (s.required as string[]) ?? []) assert.ok(props.includes(r), `${name}: ${r}`);
          for (const sub of Object.values((s.properties as Record<string, Record<string, unknown>>) ?? {})) check(sub);
        }
        if (s.type === "array" && s.items) check(s.items as Record<string, unknown>);
      };
      check(schema);
    });
  }
});
