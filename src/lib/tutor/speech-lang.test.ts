import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, speechLangFor } from "./speech-lang.ts";

test("Han characters are read in Mandarin", () => {
  assert.equal(speechLangFor("你好！我是林老师。", "zh"), "zh-CN");
  assert.equal(speechLangFor("Say 茶 with a rising tone.", "zh"), "zh-CN");
});

test("Spanish and French lines use the target voice", () => {
  assert.equal(speechLangFor("¡Hola! ¿Qué quieres tomar?", "es"), "es-ES");
  assert.equal(speechLangFor("Bonjour ! Je voudrais une baguette, s'il vous plaît.", "fr"), "fr-FR");
});

test("English coaching lines in a language session are read in English", () => {
  assert.equal(speechLangFor("Great job. Now try asking for the price.", "es"), "en-GB");
  assert.equal(speechLangFor("Good, let's say that again with the right ending.", "fr"), "en-GB");
});

test("English sessions and unknown languages read in English", () => {
  assert.equal(speechLangFor("Good morning. I'm not feeling well today.", "en"), "en-GB");
  assert.equal(speechLangFor("Hello", null), "en-GB");
});

test("pickVoice prefers an exact match, then the same base language", () => {
  const voices = [
    { name: "a", lang: "en-US", localService: true },
    { name: "b", lang: "es-MX", localService: true },
    { name: "c", lang: "zh_CN", localService: true },
    { name: "d", lang: "es-ES", localService: false },
  ];
  assert.equal(pickVoice(voices, "es-ES")?.name, "d");
  assert.equal(pickVoice(voices, "zh-CN")?.name, "c");
  assert.equal(pickVoice(voices, "en-GB")?.name, "a");
  assert.equal(pickVoice(voices, "fr-FR"), undefined);
});
