import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRefsInTenant,
  courseTenantId,
  createSupabaseRefLookup,
  TenantRefError,
  type TenantRefLookup,
} from "./refs.ts";

const PLATFORM = "org_platform";

const lookup: TenantRefLookup = {
  async courseCompany(id) {
    const courses: Record<string, string | null> = { courseA: "orgA", courseB: "orgB", coursePlatform: null };
    return id in courses ? courses[id] : undefined;
  },
  async lessonCourse(id) {
    return ({ lessonA: "courseA", lessonB: "courseB" } as Record<string, string>)[id] ?? null;
  },
  async scenarioOwner(id) {
    const rows: Record<string, { companyId: string; visibility: string }> = {
      scenA: { companyId: "orgA", visibility: "course" },
      scenB: { companyId: "orgB", visibility: "tenant_library" },
      scenPlatform: { companyId: PLATFORM, visibility: "platform" },
    };
    return rows[id] ?? null;
  },
  async personaCompany(id) {
    return ({ personaA: "orgA", personaB: "orgB", personaPlatform: PLATFORM } as Record<string, string>)[id] ?? null;
  },
  async groupCompany(id) {
    return ({ groupA: "orgA", groupB: "orgB" } as Record<string, string>)[id] ?? null;
  },
};

async function rejectsRef(refs: Parameters<typeof assertRefsInTenant>[2], ref: string, companyId = "orgA") {
  await assert.rejects(
    () => assertRefsInTenant(lookup, companyId, refs, PLATFORM),
    (err: unknown) => err instanceof TenantRefError && err.ref === ref,
  );
}

describe("assertRefsInTenant", () => {
  it("accepts refs that all belong to the tenant", async () => {
    await assertRefsInTenant(
      lookup,
      "orgA",
      { courseId: "courseA", lessonId: "lessonA", scenarioId: "scenA", personaId: "personaA", groupId: "groupA" },
      PLATFORM,
    );
  });

  it("accepts platform personas and platform-visibility scenarios", async () => {
    await assertRefsInTenant(lookup, "orgA", { personaId: "personaPlatform", scenarioId: "scenPlatform" }, PLATFORM);
  });

  it("treats courses without a company as the platform tenant", async () => {
    await assertRefsInTenant(lookup, PLATFORM, { courseId: "coursePlatform" }, PLATFORM);
    await rejectsRef({ courseId: "coursePlatform" }, "courseId");
    assert.equal(courseTenantId(null, PLATFORM), PLATFORM);
    assert.equal(courseTenantId("orgA", PLATFORM), "orgA");
  });

  it("rejects another tenant's course", () => rejectsRef({ courseId: "courseB" }, "courseId"));
  it("rejects an unknown course", () => rejectsRef({ courseId: "nope" }, "courseId"));
  it("rejects a lesson from another course", () => rejectsRef({ courseId: "courseA", lessonId: "lessonB" }, "lessonId"));
  it("rejects a lesson from another tenant when no course is given", () => rejectsRef({ lessonId: "lessonB" }, "lessonId"));
  it("rejects an unknown lesson", () => rejectsRef({ lessonId: "nope" }, "lessonId"));
  it("rejects another tenant's persona", () => rejectsRef({ personaId: "personaB" }, "personaId"));
  it("rejects another tenant's non-platform scenario", () => rejectsRef({ scenarioId: "scenB" }, "scenarioId"));
  it("rejects another tenant's group", () => rejectsRef({ groupId: "groupB" }, "groupId"));
  it("rejects an empty tenant", () => rejectsRef({}, "courseId", ""));
  it("ignores refs that are null or absent", async () => {
    await assertRefsInTenant(lookup, "orgA", { courseId: null, lessonId: null, personaId: undefined }, PLATFORM);
  });
});

describe("createSupabaseRefLookup", () => {
  const tables: Record<string, Record<string, Record<string, unknown>>> = {
    courses: { c1: { id: "c1", company_id: "orgA" }, c2: { id: "c2", company_id: null } },
    lessons: { l1: { id: "l1", module_id: "m1" } },
    modules: { m1: { id: "m1", course_id: "c1" } },
    practice_scenarios: { s1: { id: "s1", company_id: "orgA", visibility: "course" } },
    ai_personas: { p1: { id: "p1", company_id: "orgA" } },
    classroom_groups: { g1: { id: "g1", company_id: "orgA" } },
  };
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return { maybeSingle: async () => ({ data: tables[table]?.[value] ?? null, error: null }) };
            },
          };
        },
      };
    },
  };
  const live = createSupabaseRefLookup(db);

  it("maps rows to tenant ids", async () => {
    assert.equal(await live.courseCompany("c1"), "orgA");
    assert.equal(await live.courseCompany("c2"), null);
    assert.equal(await live.courseCompany("missing"), undefined);
    assert.equal(await live.lessonCourse("l1"), "c1");
    assert.equal(await live.lessonCourse("missing"), null);
    assert.deepEqual(await live.scenarioOwner("s1"), { companyId: "orgA", visibility: "course" });
    assert.equal(await live.personaCompany("p1"), "orgA");
    assert.equal(await live.groupCompany("g1"), "orgA");
  });
});
