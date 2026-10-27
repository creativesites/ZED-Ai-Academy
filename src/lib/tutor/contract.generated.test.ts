import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANCHORS,
  ARTBOARDS,
  CONTRACT_VERSION,
  GESTURES,
  HAIR_STYLES,
  MOODS,
  OUTFIT_STYLES,
  PROPS,
  RIVE_EVENTS,
  SCENE_VM_PROPS,
  TEACHER_VM_PROPS,
  TONE_SHAPES,
  TONE_TRACE,
  VISEMES,
} from "./contract.generated.ts";

// Only the parts of the JSON these tests compare against.
type ContractFixture = {
  version: string;
  enums: Record<"Gesture" | "ToneShape" | "Mood" | "HairStyle" | "OutfitStyle" | "Prop", string[]>;
  visemes: { value: number; name: string }[];
  viewModels: Record<"TeacherVM" | "SceneVM", Record<string, unknown>>;
  events: Record<string, unknown>;
  artboards: Record<string, { size: number[]; stateMachine: string; viewModel: string }>;
  toneTrace: { traceBox: number[]; durationMs: Record<string, number>; paths: Record<string, number[][]> };
  anchors: Record<string, unknown>;
};

const contract = JSON.parse(
  readFileSync(new URL("../../../docs/rive/teacher.contract.json", import.meta.url), "utf8"),
) as ContractFixture;

test("enum arrays match the contract JSON exactly", () => {
  assert.deepEqual([...GESTURES], contract.enums.Gesture);
  assert.equal(GESTURES.length, contract.enums.Gesture.length);
  assert.deepEqual([...TONE_SHAPES], contract.enums.ToneShape);
  assert.deepEqual([...MOODS], contract.enums.Mood);
  assert.deepEqual([...HAIR_STYLES], contract.enums.HairStyle);
  assert.deepEqual([...OUTFIT_STYLES], contract.enums.OutfitStyle);
  assert.deepEqual([...PROPS], contract.enums.Prop);
});

test("visemes match the contract values and names in order", () => {
  assert.deepEqual(
    VISEMES.map((v) => ({ value: v.value, name: v.name })),
    contract.visemes.map((v) => ({ value: v.value, name: v.name })),
  );
  assert.equal(VISEMES.length, 9);
});

test("view model props carry type, bounds and defaults from the JSON", () => {
  assert.deepEqual(TEACHER_VM_PROPS.moodIntensity, { type: "number", min: 0, max: 100, default: 70 });
  assert.deepEqual(TEACHER_VM_PROPS.gesture, { type: "enum", enum: "Gesture", default: "idle" });
  assert.deepEqual(TEACHER_VM_PROPS.playGesture, { type: "trigger" });
  assert.equal(Object.keys(TEACHER_VM_PROPS).length, Object.keys(contract.viewModels.TeacherVM).length);
  assert.equal(Object.keys(SCENE_VM_PROPS).length, Object.keys(contract.viewModels.SceneVM).length);
  assert.deepEqual(SCENE_VM_PROPS.timeOfDay, { type: "number", min: 0, max: 100, default: 70 });
});

test("rive events, artboards, tone trace, anchors and version match the JSON", () => {
  assert.deepEqual([...RIVE_EVENTS], Object.keys(contract.events));
  assert.deepEqual(ARTBOARDS.Teacher, {
    size: contract.artboards.Teacher.size,
    stateMachine: "TeacherSM",
    viewModel: "TeacherVM",
  });
  assert.deepEqual(Object.keys(ARTBOARDS), Object.keys(contract.artboards));
  assert.deepEqual([...TONE_TRACE.traceBox], contract.toneTrace.traceBox);
  assert.deepEqual(TONE_TRACE.durationMs, contract.toneTrace.durationMs);
  assert.deepEqual(TONE_TRACE.paths.t3, contract.toneTrace.paths.t3);
  assert.deepEqual(ANCHORS.headCenter, contract.anchors.headCenter);
  assert.equal(CONTRACT_VERSION, contract.version);
});
