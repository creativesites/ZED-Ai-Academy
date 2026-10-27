import { test } from "node:test";
import assert from "node:assert/strict";
import {
  overlayModes,
  parseTutorSessionBlock,
  personaLookFromVariant,
  scenarioViewFromRow,
  sceneFromValue,
  tutorSessionBlockSchema,
} from "./tutor-session-block.ts";

const ID = "7a1e0000-0000-4000-8000-000000000101";

test("a minimal valid tutor_session block parses", () => {
  const block = parseTutorSessionBlock({ scenarioId: ID, style: "scene", required: false });
  assert.deepEqual(block, { scenarioId: ID, style: "scene", required: false });
});

test("title and intro are trimmed and optional", () => {
  const block = parseTutorSessionBlock({
    scenarioId: ID,
    style: "guided_lesson",
    required: true,
    title: "  Order tea  ",
    intro: "Use today's words.",
  });
  assert.equal(block?.title, "Order tea");
  assert.equal(block?.intro, "Use today's words.");
  assert.equal(block?.required, true);
});

test("every style in the contract is accepted and unknown styles are rejected", () => {
  for (const style of ["scene", "guided_lesson", "oral_check"]) {
    assert.ok(tutorSessionBlockSchema.safeParse({ scenarioId: ID, style, required: false }).success, style);
  }
  assert.equal(parseTutorSessionBlock({ scenarioId: ID, style: "quiz", required: false }), null);
});

test("scenarioId must be a uuid, so an unconfigured block (empty id) does not parse", () => {
  assert.equal(parseTutorSessionBlock({ scenarioId: "", style: "scene", required: false }), null);
  assert.equal(parseTutorSessionBlock({ scenarioId: "not-a-uuid", style: "scene", required: false }), null);
});

test("required must be a boolean, not a string", () => {
  assert.equal(parseTutorSessionBlock({ scenarioId: ID, style: "scene", required: "yes" }), null);
});

test("over-long title or intro is rejected", () => {
  assert.equal(
    parseTutorSessionBlock({ scenarioId: ID, style: "scene", required: false, title: "x".repeat(121) }),
    null,
  );
  assert.equal(
    parseTutorSessionBlock({ scenarioId: ID, style: "scene", required: false, intro: "x".repeat(601) }),
    null,
  );
});

test("garbage input returns null and never throws", () => {
  for (const v of [null, undefined, 42, "x", [], {}]) {
    assert.equal(parseTutorSessionBlock(v), null);
  }
});

test("personaLookFromVariant keeps valid contract values and drops invalid ones", () => {
  const look = personaLookFromVariant({
    skinColor: "#E8B48F",
    hairColor: "red",
    hairStyle: "bob",
    outfitStyle: "scrubs",
    prop: "stethoscope",
    faceStyle: "tendai",
  });
  assert.deepEqual(look, {
    skinColor: "#E8B48F",
    hairStyle: "bob",
    outfitStyle: "scrubs",
    prop: "stethoscope",
    faceStyle: "tendai",
  });
});

test("personaLookFromVariant returns undefined when nothing is usable", () => {
  assert.equal(personaLookFromVariant({}), undefined);
  assert.equal(personaLookFromVariant({ faceStyle: "nobody" }), undefined);
  assert.equal(personaLookFromVariant(null), undefined);
  assert.equal(personaLookFromVariant(["#E8B48F"]), undefined);
});

test("sceneFromValue only accepts the Rive artboards", () => {
  assert.equal(sceneFromValue("Scene_Clinic"), "Scene_Clinic");
  assert.equal(sceneFromValue("Scene_Space"), undefined);
  assert.equal(sceneFromValue(undefined), undefined);
});

test("scenarioViewFromRow maps a joined row and falls back on unknown values", () => {
  const view = scenarioViewFromRow({
    id: ID,
    title: "Mandarin tea house",
    goal: "Order tea",
    style: "guided_lesson",
    scene: "Scene_TeaHouse",
    max_minutes: 6,
    allowed_modes: ["live", "voice"],
    ai_personas: {
      name: "Lín Lǎoshī",
      display_name: null,
      rive_variant: { hairStyle: "bob", faceStyle: "lin", skinColor: "#E8B48F" },
    },
  });
  assert.equal(view.style, "guided_lesson");
  assert.equal(view.scene, "Scene_TeaHouse");
  assert.deepEqual(view.modes, ["voice"]);
  assert.equal(view.persona?.name, "Lín Lǎoshī");
  assert.equal(view.persona?.look?.faceStyle, "lin");

  const fallback = scenarioViewFromRow({
    id: ID,
    title: "x",
    goal: "y",
    style: "lecture",
    scene: "Scene_Space",
    max_minutes: null,
    allowed_modes: null,
    ai_personas: null,
  });
  assert.equal(fallback.style, "scene");
  assert.equal(fallback.scene, undefined);
  assert.equal(fallback.maxMinutes, 8);
  assert.deepEqual(fallback.modes, ["voice", "text"]);
  assert.equal(fallback.persona, null);
});

test("overlayModes drops live and falls back to voice and text", () => {
  assert.deepEqual(overlayModes(["live", "voice"]), ["voice"]);
  assert.deepEqual(overlayModes(["live"]), ["voice", "text"]);
  assert.deepEqual(overlayModes(["text", "voice"]), ["text", "voice"]);
});
