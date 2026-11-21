import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTHORING_TEMPLATES, AUTHORING_TEMPLATE_IDS, getAuthoringTemplate } from "./templates.ts";
import { SCENARIO_STYLES } from "../scenario.ts";
import { SCENE_ARTBOARDS } from "../rive-driver.ts";

test("all six authoring templates are defined with valid styles, scenes, and skeletons", () => {
  assert.equal(AUTHORING_TEMPLATES.length, 6);
  assert.deepEqual(
    AUTHORING_TEMPLATES.map((t) => t.id),
    [...AUTHORING_TEMPLATE_IDS],
  );

  for (const tpl of AUTHORING_TEMPLATES) {
    assert.ok(tpl.label.length > 0);
    assert.ok(tpl.tagline.length > 0);
    assert.ok((SCENARIO_STYLES as readonly string[]).includes(tpl.style));
    assert.ok((SCENE_ARTBOARDS as readonly string[]).includes(tpl.defaultScene));
    assert.ok(tpl.maxMinutes >= 1 && tpl.maxMinutes <= 30);
    assert.ok(tpl.stepSkeleton.length >= 3 && tpl.stepSkeleton.length <= 5);
    assert.ok(tpl.promptHints.length > 20);
  }
});

test("getAuthoringTemplate returns requested template or falls back to explain_check", () => {
  assert.equal(getAuthoringTemplate("oral_check").id, "oral_check");
  assert.equal(getAuthoringTemplate("debate_defend").style, "oral_check");
  assert.equal(getAuthoringTemplate("unknown-id").id, "explain_check");
  assert.equal(getAuthoringTemplate(null).id, "explain_check");
});
