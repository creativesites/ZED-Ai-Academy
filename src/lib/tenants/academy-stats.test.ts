import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeAcademyStats, hasAnyStat } from "./academy-stats.ts";

const empty = { learnerCount: 0, enrollmentCount: 0, completionCount: 0, ratingAverage: null, ratingCount: 0 };

describe("computeAcademyStats", () => {
  it("shows nothing for a new academy (no made-up numbers)", () => {
    const stats = computeAcademyStats(empty);
    assert.deepEqual(stats, { students: null, rating: null, success: null });
    assert.equal(hasAnyStat(stats), false);
  });

  it("uses real counts", () => {
    const stats = computeAcademyStats({
      learnerCount: 14,
      enrollmentCount: 20,
      completionCount: 5,
      ratingAverage: 4.25,
      ratingCount: 4,
    });
    assert.deepEqual(stats, { students: "14", rating: "4.3/5", success: "25%" });
    assert.equal(computeAcademyStats({ ...empty, learnerCount: 1234 }).students, "1,234+");
  });

  it("hides a success rate of zero", () => {
    assert.equal(computeAcademyStats({ ...empty, learnerCount: 3, enrollmentCount: 3 }).success, null);
  });

  it("prefers values the owner typed into the page", () => {
    const stats = computeAcademyStats(empty, { stats_students: "200+", stats_rating: " ", stats_success: 5 });
    assert.deepEqual(stats, { students: "200+", rating: null, success: null });
  });
});
