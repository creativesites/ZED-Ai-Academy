import test from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "./safe-redirect.ts";

const O = "https://learn.creativesites.site";

test("relative same-site paths pass through", () => {
  assert.equal(safeRedirectPath("/academy/x/classroom?a=1", O), "/academy/x/classroom?a=1");
  assert.equal(safeRedirectPath("/courses/a#top", O), "/courses/a#top");
});

test("protocol-relative, backslash and scheme tricks are rejected", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "/\\\\evil.com", "\\\\evil.com", "/%0d%0a", "javascript:alert(1)", "https://evil.com/x", "/\tevil", "evil.com"]) {
    const out = safeRedirectPath(bad, O);
    assert.ok(out === null || out.startsWith("/"), bad);
    if (out) assert.ok(!out.startsWith("//"), bad);
  }
  assert.equal(safeRedirectPath("/\\evil.com", O), null);
  assert.equal(safeRedirectPath("https://evil.com/x", O), null);
});

test("absolute URLs are allowed only for same origin or allowed hosts", () => {
  assert.equal(safeRedirectPath(`${O}/dashboard`, O), "/dashboard");
  const allow = (h: string) => h === "creativesites.site" || h.endsWith(".creativesites.site");
  assert.equal(safeRedirectPath("https://glory.creativesites.site/x", O, allow), "/x");
  assert.equal(safeRedirectPath("https://creativesites.site.evil.com/x", O, allow), null);
});
