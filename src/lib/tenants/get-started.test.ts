import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getStartedSteps, hasCustomBranding, shouldShowGetStarted, whatsappShareUrl } from "./get-started.ts";

const fresh = { logoUrl: null, primaryColor: "#fd5523", courseCount: 0, publishedCourseCount: 0, learnerCount: 0 };

describe("getStartedSteps", () => {
  it("marks nothing done for a brand-new academy", () => {
    assert.deepEqual(
      getStartedSteps(fresh).map((s) => [s.id, s.done]),
      [["branding", false], ["course", false], ["publish", false], ["invite", false]]
    );
  });

  it("computes each step from data", () => {
    const steps = getStartedSteps({
      ...fresh,
      logoUrl: "https://x/logo.png",
      courseCount: 2,
      publishedCourseCount: 1,
      learnerCount: 14,
    });
    assert.ok(steps.every((s) => s.done));
    const draftOnly = getStartedSteps({ ...fresh, courseCount: 1 });
    assert.deepEqual(draftOnly.map((s) => s.done), [false, true, false, false]);
  });
});

describe("hasCustomBranding", () => {
  it("treats the default colour as not customised", () => {
    assert.equal(hasCustomBranding({ logoUrl: null, primaryColor: "#FD5523" }), false);
    assert.equal(hasCustomBranding({ logoUrl: "  ", primaryColor: null }), false);
    assert.equal(hasCustomBranding({ logoUrl: null, primaryColor: "#0055ff" }), true);
    assert.equal(hasCustomBranding({ logoUrl: "https://x/l.png", primaryColor: null }), true);
  });
});

describe("shouldShowGetStarted", () => {
  it("shows on welcome or while nothing is published", () => {
    assert.equal(shouldShowGetStarted({ welcome: true, publishedCourseCount: 3 }), true);
    assert.equal(shouldShowGetStarted({ welcome: false, publishedCourseCount: 0 }), true);
    assert.equal(shouldShowGetStarted({ welcome: false, publishedCourseCount: 1 }), false);
  });
});

describe("whatsappShareUrl", () => {
  it("encodes the message and link", () => {
    assert.equal(
      whatsappShareUrl("Join my class:", "https://a.b/academy/x/join"),
      "https://wa.me/?text=Join%20my%20class%3A%20https%3A%2F%2Fa.b%2Facademy%2Fx%2Fjoin"
    );
  });
});
