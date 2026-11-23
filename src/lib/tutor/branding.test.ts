import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyBrandColorsToLook, mergeBrandLook, normalizeHexColor } from "./branding.ts";

describe("tutor/branding", () => {
  it("normalizes 3-digit and 6-digit hex colors cleanly and rejects invalid inputs", () => {
    assert.equal(normalizeHexColor("#fd5523"), "#FD5523");
    assert.equal(normalizeHexColor("#abc"), "#AABBCC");
    assert.equal(normalizeHexColor("not-a-color"), null);
    assert.equal(normalizeHexColor(null), null);
  });

  it("applies academy primary colors to outfit and trim without altering skin or hair", () => {
    const updated = applyBrandColorsToLook(
      {
        skinColor: "#7A4A30",
        hairColor: "#14100E",
        outfitPrimary: "#2F4A6B",
        outfitSecondary: "#F4F7FA",
        accentColor: "#F4F7FA",
        faceStyle: "tinashe",
      },
      { primaryColor: "#062e39" },
    );
    assert.equal(updated.outfitPrimary, "#062E39");
    assert.equal(updated.skinColor, "#7A4A30");
    assert.equal(updated.hairColor, "#14100E");
    assert.ok(updated.outfitSecondary?.startsWith("#"));
  });

  it("merges academy brand overrides onto teacher base look", () => {
    const merged = mergeBrandLook(
      { faceStyle: "tinashe", outfitPrimary: "#2F4A6B" },
      { outfitPrimary: "#FD5523", accentColor: "#FFFFFF" },
    );
    assert.equal(merged?.faceStyle, "tinashe");
    assert.equal(merged?.outfitPrimary, "#FD5523");
    assert.equal(merged?.accentColor, "#FFFFFF");
  });
});
