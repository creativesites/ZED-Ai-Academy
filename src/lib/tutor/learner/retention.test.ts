import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gradeRetentionChecks,
  nextRetentionCheckAt,
  pendingRetentionCheck,
  retentionCheckAt,
  summariseRetention,
} from "./retention.ts";

const SECURED = "2026-11-01T00:00:00.000Z";
const at = (days: number) => new Date(Date.parse(SECURED) + days * 86_400_000).toISOString();

describe("retention scheduling", () => {
  it("computes checkpoints 7 and 30 days after secured_at", () => {
    assert.equal(retentionCheckAt(SECURED, 7), at(7));
    assert.equal(retentionCheckAt(SECURED, 30), at(30));
  });

  it("is pending only once a checkpoint has elapsed with no evidence since", () => {
    assert.equal(pendingRetentionCheck({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(6)), null);
    assert.deepEqual(pendingRetentionCheck({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(8)), {
      checkpoint: 7,
      dueAt: at(7),
    });
    assert.equal(pendingRetentionCheck({ securedAt: SECURED, lastEvidenceAt: at(7.5) }, at(8)), null);
    assert.equal(pendingRetentionCheck({ securedAt: SECURED, lastEvidenceAt: at(7.5) }, at(31))?.checkpoint, 30);
  });

  it("reports the 30-day check when the learner was away past both", () => {
    assert.equal(pendingRetentionCheck({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(40))?.checkpoint, 30);
  });

  it("never schedules for objectives that were not secured", () => {
    assert.equal(pendingRetentionCheck({ securedAt: null, lastEvidenceAt: null }, at(40)), null);
    assert.equal(nextRetentionCheckAt({ securedAt: null, lastEvidenceAt: null }, at(1)), null);
  });

  it("gives the next future checkpoint", () => {
    assert.equal(nextRetentionCheckAt({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(1)), at(7));
    assert.equal(nextRetentionCheckAt({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(8)), at(30));
    assert.equal(nextRetentionCheckAt({ securedAt: SECURED, lastEvidenceAt: SECURED }, at(31)), null);
  });
});

describe("gradeRetentionChecks", () => {
  it("grades the first evidence at or after each checkpoint", () => {
    const res = gradeRetentionChecks(
      SECURED,
      [
        { at: at(31), score: 0.5 },
        { at: at(3), score: 0 }, // before the 7-day checkpoint: not a retention check
        { at: at(9), score: 1 },
        { at: at(12), score: 0 },
      ],
      at(40),
    );
    assert.deepEqual(
      res.map((r) => [r.checkpoint, r.status, r.checkedAt]),
      [
        [7, "passed", at(9)],
        [30, "failed", at(31)],
      ],
    );
  });

  it("distinguishes pending from not yet due", () => {
    const res = gradeRetentionChecks(SECURED, [], at(10));
    assert.deepEqual(res.map((r) => r.status), ["pending", "not_due"]);
    assert.deepEqual(gradeRetentionChecks(null, [], at(10)), []);
  });

  it("uses the knowledge rule's success threshold (0.75)", () => {
    assert.equal(gradeRetentionChecks(SECURED, [{ at: at(8), score: 0.75 }], at(9))[0].status, "passed");
    assert.equal(gradeRetentionChecks(SECURED, [{ at: at(8), score: 0.74 }], at(9))[0].status, "failed");
  });
});

describe("summariseRetention", () => {
  it("computes the share of answered checks that passed, per checkpoint", () => {
    const s = summariseRetention([
      { checkpoint: 7, passed: true },
      { checkpoint: 7, passed: false },
      { checkpoint: 30, passed: true },
      { checkpoint: 30, passed: null },
      { checkpoint: 14, passed: true },
    ]);
    assert.equal(s.checks, 3);
    assert.equal(s.passed, 2);
    assert.equal(s.accuracy, 0.667);
    assert.deepEqual(s.byCheckpoint.d7, { checks: 2, passed: 1, accuracy: 0.5 });
    assert.deepEqual(s.byCheckpoint.d30, { checks: 1, passed: 1, accuracy: 1 });
  });

  it("returns null accuracy with no answered checks", () => {
    assert.equal(summariseRetention([]).accuracy, null);
  });
});
