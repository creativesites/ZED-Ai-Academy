import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RESERVED_SLUGS, RESERVED_SUBDOMAINS, baseAcademySlug, isReservedSlug, pickAvailableSlug } from "./slug.ts";

describe("baseAcademySlug", () => {
  it("lowercases and dashes names", () => {
    assert.equal(baseAcademySlug("Lusaka ICT Academy"), "lusaka-ict-academy");
    assert.equal(baseAcademySlug("  Mwansa's   Coding -- Club!! "), "mwansa-s-coding-club");
  });

  it("strips accents and falls back for empty names", () => {
    assert.equal(baseAcademySlug("École Café"), "ecole-cafe");
    assert.equal(baseAcademySlug("!!!"), "academy");
    assert.equal(baseAcademySlug(""), "academy");
  });

  it("caps the length without a trailing dash", () => {
    const slug = baseAcademySlug("a".repeat(47) + " b c d e");
    assert.ok(slug.length <= 48);
    assert.ok(!slug.endsWith("-"));
  });
});

describe("pickAvailableSlug", () => {
  it("returns the base slug when it is free", () => {
    assert.equal(pickAvailableSlug("Kabwe Tech", []), "kabwe-tech");
  });

  it("adds a numeric suffix on collision", () => {
    assert.equal(pickAvailableSlug("Kabwe Tech", ["kabwe-tech"]), "kabwe-tech-2");
    assert.equal(pickAvailableSlug("Kabwe Tech", ["kabwe-tech", "kabwe-tech-2", "kabwe-tech-3"]), "kabwe-tech-4");
  });

  it("never returns a reserved name", () => {
    for (const name of ["Admin", "API", "www", "Dashboard", "Academy", "Join", "Sign In"]) {
      const slug = pickAvailableSlug(name, []);
      assert.ok(!isReservedSlug(slug), `${name} -> ${slug}`);
    }
    assert.equal(pickAvailableSlug("Admin", []), "admin-2");
    assert.equal(pickAvailableSlug("Academy", ["academy-2"]), "academy-3");
    // Empty names fall back to "academy", which is reserved.
    assert.equal(pickAvailableSlug("???", []), "academy-2");
  });

  it("reserves every subdomain the proxy reserves", () => {
    for (const sub of RESERVED_SUBDOMAINS) assert.ok(RESERVED_SLUGS.has(sub), sub);
  });
});
