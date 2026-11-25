import { test } from "node:test";
import assert from "node:assert/strict";
import {
  academyBase,
  academyHref,
  academySlugFromPath,
  cleanAcademySlug,
  lessonHref,
} from "./academy-href.ts";

test("academyBase: academy slug gives /academy/<slug>; none or invalid gives the platform root", () => {
  assert.equal(academyBase("acme"), "/academy/acme");
  assert.equal(academyBase(" Acme "), "/academy/acme");
  assert.equal(academyBase(null), "");
  assert.equal(academyBase(undefined), "");
  assert.equal(academyBase(""), "");
  assert.equal(academyBase("../evil"), "");
  assert.equal(academyBase("a/b"), "");
  assert.equal(academyBase("x?y=1"), "");
});

test("academyHref: teacher pages stay inside the academy", () => {
  assert.equal(academyHref("acme", "/practice"), "/academy/acme/practice");
  assert.equal(academyHref("acme", "/practice/deck"), "/academy/acme/practice/deck");
  assert.equal(academyHref("acme", "/practice/s1?lessonId=l1&back=%2Fx"), "/academy/acme/practice/s1?lessonId=l1&back=%2Fx");
  assert.equal(academyHref("acme", "/classroom"), "/academy/acme/classroom");
  assert.equal(academyHref("acme", "/"), "/academy/acme");
});

test("academyHref: platform learners keep platform paths", () => {
  assert.equal(academyHref(null, "/practice/deck"), "/practice/deck");
  assert.equal(academyHref("", "/practice"), "/practice");
});

test("academyHref: platform-only routes are never prefixed", () => {
  assert.equal(academyHref("acme", "/courses/intro/learn"), "/courses/intro/learn");
  assert.equal(academyHref("acme", "/courses/intro/learn?lesson=l1"), "/courses/intro/learn?lesson=l1");
  assert.equal(academyHref("acme", "/courses/intro/checkout"), "/courses/intro/checkout");
  assert.equal(academyHref("acme", "/certificates/abc"), "/certificates/abc");
  assert.equal(academyHref("acme", "/live-sessions"), "/live-sessions");
  assert.equal(academyHref("acme", "/try/s1"), "/try/s1");
  // A course detail page does exist under the academy.
  assert.equal(academyHref("acme", "/courses/intro"), "/academy/acme/courses/intro");
  // "/learning" is not the lesson player.
  assert.equal(academyHref("acme", "/courses/intro/learning"), "/academy/acme/courses/intro/learning");
});

test("academyHref: links that already name an academy, or are external/relative, are unchanged", () => {
  assert.equal(academyHref("acme", "/academy/other/practice"), "/academy/other/practice");
  assert.equal(academyHref("acme", "https://example.com/practice"), "https://example.com/practice");
  assert.equal(academyHref("acme", "//evil.com/practice"), "//evil.com/practice");
  assert.equal(academyHref("acme", "#section"), "#section");
});

test("academyHref: an academy-prefixed lesson link is sent to the one lesson player", () => {
  assert.equal(academyHref("acme", "/academy/acme/courses/intro/learn"), "/courses/intro/learn");
  assert.equal(academyHref(null, "/academy/acme/courses/intro/learn?lesson=l1"), "/courses/intro/learn?lesson=l1");
  // The academy course page is real and stays.
  assert.equal(academyHref("acme", "/academy/acme/courses/intro"), "/academy/acme/courses/intro");
});

test("lessonHref: one lesson player route, optionally at a lesson", () => {
  assert.equal(lessonHref("intro"), "/courses/intro/learn");
  assert.equal(lessonHref("intro", "l 1"), "/courses/intro/learn?lesson=l%201");
  assert.equal(lessonHref("a b"), "/courses/a%20b/learn");
  assert.equal(lessonHref("intro", null), "/courses/intro/learn");
});

test("academySlugFromPath and cleanAcademySlug", () => {
  assert.equal(academySlugFromPath("/academy/acme/practice"), "acme");
  assert.equal(academySlugFromPath("/academy/acme"), "acme");
  assert.equal(academySlugFromPath("/practice"), null);
  assert.equal(academySlugFromPath("/courses/x/learn"), null);
  assert.equal(academySlugFromPath(null), null);
  assert.equal(cleanAcademySlug("ACME-1"), "acme-1");
  assert.equal(cleanAcademySlug("-bad"), null);
});
