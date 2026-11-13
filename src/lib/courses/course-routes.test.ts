import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCourseEditorPath,
  getCourseListPath,
  getLessonEditorPath,
  normalizeCourseSlug,
} from "./course-routes.ts";
import { evaluateCourseManageAccess } from "./course-auth.ts";

describe("Deploy Course Studio & Tenant Route Resolution", () => {
  it("routes tenant course creation to /academy/{tenantSlug}/admin/courses/{courseId}", () => {
    const courseId = "course-123";
    const tenantSlug = "lusaka-tech";

    assert.equal(
      getCourseEditorPath(courseId, tenantSlug),
      "/academy/lusaka-tech/admin/courses/course-123"
    );
    assert.equal(
      getLessonEditorPath(courseId, "lesson-456", tenantSlug),
      "/academy/lusaka-tech/admin/courses/course-123/lessons/lesson-456"
    );
    assert.equal(getCourseListPath(tenantSlug), "/academy/lusaka-tech/admin/courses");
  });

  it("falls back to /creator/courses/{courseId} when no tenantSlug is provided", () => {
    assert.equal(getCourseEditorPath("course-123"), "/creator/courses/course-123");
    assert.equal(getCourseEditorPath("course-123", ""), "/creator/courses/course-123");
    assert.equal(getCourseEditorPath("course-123", "   "), "/creator/courses/course-123");
    assert.equal(
      getLessonEditorPath("course-123", "lesson-456", null),
      "/creator/courses/course-123/lessons/lesson-456"
    );
    assert.equal(getCourseListPath(), "/creator/courses");
  });

  it("normalizes course slugs safely even for non-ASCII or punctuation-only titles", () => {
    assert.equal(normalizeCourseSlug("AI Workflows for Teams!"), "ai-workflows-for-teams");
    assert.equal(normalizeCourseSlug("!!!"), "course");
    assert.equal(normalizeCourseSlug("   "), "course");
  });
});

describe("Tenant Course Authorization (evaluateCourseManageAccess)", () => {
  const baseCourse = {
    courseInstructorId: "user_creator",
    courseCompanyId: "org_academy_a",
  };

  it("allows the original course instructor", () => {
    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_creator",
        profileRole: "instructor",
      }),
      true
    );
  });

  it("allows active company_admin, teacher, and instructor of the owning tenant", () => {
    for (const membershipRole of ["company_admin", "teacher", "instructor"] as const) {
      assert.equal(
        evaluateCourseManageAccess({
          ...baseCourse,
          userId: "user_staff",
          profileRole: "learner",
          membershipStatus: "active",
          membershipRole,
        }),
        true,
        `expected ${membershipRole} to be allowed`
      );
    }
  });

  it("allows the company owner (admin_id) even if company_members row is absent", () => {
    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_owner",
        profileRole: "company_admin",
        companyAdminId: "user_owner",
      }),
      true
    );
  });

  it("denies learners and invited/deactivated staff of the owning tenant", () => {
    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_learner",
        profileRole: "learner",
        membershipStatus: "active",
        membershipRole: "learner",
      }),
      false
    );

    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_invited_teacher",
        profileRole: "teacher",
        membershipStatus: "invited",
        membershipRole: "teacher",
      }),
      false
    );
  });

  it("denies staff from another tenant (no membership in Academy A)", () => {
    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_academy_b_admin",
        profileRole: "company_admin",
        membershipStatus: null,
        membershipRole: null,
      }),
      false
    );
  });

  it("allows platform super_admin", () => {
    assert.equal(
      evaluateCourseManageAccess({
        ...baseCourse,
        userId: "user_super",
        profileRole: "super_admin",
      }),
      true
    );
  });
});
