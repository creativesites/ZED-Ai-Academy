import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLite } from "../lite-mode.ts";
import {
  preferencesFromRow,
  preferencesPatchSchema,
  preferencesPatchToRow,
  resolvePreferMode,
  EMPTY_PREFERENCES,
} from "./preferences.ts";

test("rows map to preferences; unknown values become null", () => {
  assert.deepEqual(preferencesFromRow(null), EMPTY_PREFERENCES);
  const p = preferencesFromRow({ preferred_mode: "live", speech_rate: "1.25", captions: true, data_saver: "yes", ui_language: "en" });
  assert.equal(p.preferredMode, null);
  assert.equal(p.speechRate, 1.25);
  assert.equal(p.captions, true);
  assert.equal(p.dataSaver, null);
  assert.equal(p.uiLanguage, "en");
});

test("patch schema validates and maps only present keys", () => {
  const ok = preferencesPatchSchema.parse({ dataSaver: true, uiLanguage: "en-ZM" });
  assert.deepEqual(preferencesPatchToRow(ok), { data_saver: true, ui_language: "en-ZM" });
  assert.deepEqual(preferencesPatchToRow(preferencesPatchSchema.parse({ preferredMode: null })), { preferred_mode: null });
  for (const bad of [{ speechRate: 5 }, { preferredMode: "live" }, { uiLanguage: "<script>" }, { userId: "x" }]) {
    assert.equal(preferencesPatchSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("mode hint: client hint, then account preference, then none", () => {
  const acct = { ...EMPTY_PREFERENCES, preferredMode: "text" as const };
  assert.equal(resolvePreferMode("voice", acct), "voice");
  assert.equal(resolvePreferMode(undefined, acct), "text");
  assert.equal(resolvePreferMode(undefined, null), undefined);
  assert.equal(resolvePreferMode(undefined, EMPTY_PREFERENCES), undefined);
});

test("lite: device choice, then account data saver, then network", () => {
  assert.equal(resolveLite("0", { saveData: true }, true), false);
  assert.equal(resolveLite("1", null, false), true);
  assert.equal(resolveLite(null, { saveData: true }, false), false);
  assert.equal(resolveLite(null, null, true), true);
  assert.equal(resolveLite(null, { effectiveType: "3g" }, null), true);
  assert.equal(resolveLite(null, { effectiveType: "4g" }), false);
});
