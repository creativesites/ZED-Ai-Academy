import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SCENARIO_SNAPSHOT_FIELDS,
  applySnapshot,
  isArchivedScenario,
  nextVersionNumber,
  parseSnapshot,
  planRestore,
  planSaveVersion,
  planSessionPin,
  snapshotFromScenarioRow,
  snapshotsEqual,
  summarizeVersions,
} from "./versions.ts";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "s1",
    company_id: "tenant-a",
    course_id: "c1",
    lesson_id: "l1",
    visibility: "course",
    status: "published",
    skill_pack: "general-tutor",
    persona_id: "p1",
    title: "Fractions",
    goal: "Add fractions",
    beats: [{ id: "b1", goal: "Same denominator" }],
    target_items: [],
    level: null,
    exam_task: null,
    max_minutes: 8,
    allowed_modes: ["voice", "text"],
    scene: "Scene_Classroom",
    style: "guided_lesson",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

test("a snapshot holds teaching content only, never placement or access", () => {
  const snap = snapshotFromScenarioRow(row());
  assert.deepEqual(Object.keys(snap).sort(), [...SCENARIO_SNAPSHOT_FIELDS].sort());
  for (const key of ["id", "company_id", "course_id", "lesson_id", "visibility", "status", "created_at"]) {
    assert.ok(!(key in snap), key);
  }
});

test("editing a flow mid-session does not change that session: the pinned snapshot wins over the live row", () => {
  const pinned = snapshotFromScenarioRow(row());
  const edited = row({ title: "Fractions v2", beats: [{ id: "b9", goal: "Different denominators" }], max_minutes: 20 });
  const running = applySnapshot(edited, pinned);
  assert.equal(running.title, "Fractions");
  assert.deepEqual(running.beats, [{ id: "b1", goal: "Same denominator" }]);
  assert.equal(running.max_minutes, 8);
  // Identity, tenant and access always come from the live row.
  assert.equal(running.id, "s1");
  assert.equal(running.company_id, "tenant-a");
  assert.equal(running.status, "published");
});

test("an unpinned session (or a missing snapshot) runs the live row, as before versioning", () => {
  const live = row({ title: "Live" });
  assert.equal(applySnapshot(live, null), live);
});

test("a partial snapshot only overrides the fields it has", () => {
  const out = applySnapshot(row(), { title: "Old title" });
  assert.equal(out.title, "Old title");
  assert.equal(out.goal, "Add fractions");
});

test("parseSnapshot drops unknown keys and rejects non-objects", () => {
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot([1, 2]), null);
  assert.equal(parseSnapshot("x"), null);
  assert.equal(parseSnapshot({ company_id: "evil" }), null, "no content fields: not a snapshot");
  assert.deepEqual(parseSnapshot({ title: "T", company_id: "evil", status: "published" }), { title: "T" });
});

test("snapshotsEqual ignores key order but not content", () => {
  assert.ok(snapshotsEqual({ title: "A", beats: [{ id: "x", goal: "g" }] }, { beats: [{ goal: "g", id: "x" }], title: "A" }));
  assert.ok(!snapshotsEqual({ title: "A" }, { title: "B" }));
  assert.ok(!snapshotsEqual({ title: "A" }, null));
  assert.ok(snapshotsEqual(null, null));
});

test("nextVersionNumber", () => {
  assert.equal(nextVersionNumber([]), 1);
  assert.equal(nextVersionNumber([1, 3, 2]), 4);
  assert.equal(nextVersionNumber([0, -1, 1.5]), 1, "invalid numbers are ignored");
});

test("saving creates v1, then v2 on change, and reuses the latest when nothing changed", () => {
  const snap = snapshotFromScenarioRow(row());
  assert.deepEqual(planSaveVersion({ snapshot: snap, latest: null }), { action: "create", version: 1 });
  const changed = snapshotFromScenarioRow(row({ goal: "Subtract fractions" }));
  assert.deepEqual(planSaveVersion({ snapshot: changed, latest: { version: 1, snapshot: snap } }), {
    action: "create",
    version: 2,
  });
  assert.deepEqual(planSaveVersion({ snapshot: snap, latest: { version: 1, snapshot: snap } }), {
    action: "reuse",
    version: 1,
  });
  assert.deepEqual(planSaveVersion({ snapshot: snap, latest: { version: 1, snapshot: snap }, forceNew: true }), {
    action: "create",
    version: 2,
  });
});

test("restore creates a new version from an old snapshot", () => {
  const v1 = snapshotFromScenarioRow(row());
  const v2 = snapshotFromScenarioRow(row({ title: "Second" }));
  const plan = planRestore({ target: 1, versions: [{ version: 2, snapshot: v2 }, { version: 1, snapshot: v1 }] });
  assert.ok(plan.ok);
  if (!plan.ok) return;
  assert.equal(plan.version, 3);
  assert.equal(plan.snapshot.title, "Fractions");
  assert.equal(plan.note, "Restored from v1");
});

test("restore refuses a missing version or a corrupt snapshot", () => {
  assert.deepEqual(planRestore({ target: 7, versions: [{ version: 1, snapshot: { title: "x" } }] }), {
    ok: false,
    reason: "version_not_found",
  });
  assert.deepEqual(planRestore({ target: 1, versions: [{ version: 1, snapshot: "garbage" }] }), {
    ok: false,
    reason: "invalid_snapshot",
  });
});

test("session pinning: published version, lazy v1, or none before the migration", () => {
  assert.deepEqual(planSessionPin({ versioningAvailable: true, publishedVersion: 4 }), { action: "pin", version: 4 });
  assert.deepEqual(planSessionPin({ versioningAvailable: true, publishedVersion: null }), { action: "create_v1" });
  assert.deepEqual(planSessionPin({ versioningAvailable: true, publishedVersion: 0 }), { action: "create_v1" });
  assert.deepEqual(planSessionPin({ versioningAvailable: false, publishedVersion: 4 }), { action: "none" });
});

test("archived flows are recognised by archived_at", () => {
  assert.equal(isArchivedScenario({ archived_at: "2026-11-25T00:00:00Z" }), true);
  assert.equal(isArchivedScenario({ archived_at: null }), false);
  assert.equal(isArchivedScenario({}), false);
});

test("summarizeVersions lists newest first with the snapshot title", () => {
  const out = summarizeVersions([
    { version: 1, snapshot: { title: "One" }, created_at: "a", created_by: "u1", note: "Initial version" },
    { version: 2, snapshot: { title: "Two" }, created_at: "b", created_by: null, note: null },
    { version: 3, snapshot: "bad", created_at: "c", created_by: null, note: "Restored from v1" },
  ]);
  assert.deepEqual(
    out.map((v) => [v.version, v.title]),
    [
      [3, ""],
      [2, "Two"],
      [1, "One"],
    ],
  );
});

test("the SQL backfill snapshots exactly SCENARIO_SNAPSHOT_FIELDS", () => {
  const sql = readFileSync(new URL("../../../../scripts/sql/backfill-scenario-versions.sql", import.meta.url), "utf8");
  const keys = [...sql.matchAll(/'([a-z_]+)', (?:s\.|to_jsonb)/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), [...SCENARIO_SNAPSHOT_FIELDS].sort());
});
