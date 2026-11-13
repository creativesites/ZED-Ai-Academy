import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessTenantAdmin,
  countTodaysSchedules,
  getDatabaseDayOfWeek,
} from "./admin-helpers.ts";

test("canAccessTenantAdmin denies unauthenticated users", () => {
  assert.equal(
    canAccessTenantAdmin({ userId: null, isSuperAdmin: true }),
    false
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "", companyAdminId: "u1" }),
    false
  );
});

test("canAccessTenantAdmin allows super admins and academy owners", () => {
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", isSuperAdmin: true }),
    true
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", companyAdminId: "u1", adminOnly: true }),
    true
  );
});

test("canAccessTenantAdmin respects teaching roles and adminOnly flag", () => {
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", tenantRole: "company_admin", adminOnly: true }),
    true
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", tenantRole: "teacher", adminOnly: true }),
    false
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", tenantRole: "teacher", adminOnly: false }),
    true
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", tenantRole: "instructor", adminOnly: false }),
    true
  );
  assert.equal(
    canAccessTenantAdmin({ userId: "u1", tenantRole: "learner", adminOnly: false }),
    false
  );
});

test("getDatabaseDayOfWeek maps Monday=1 through Sunday=7", () => {
  // 2026-11-09 is Monday
  assert.equal(getDatabaseDayOfWeek(new Date("2026-11-09T10:00:00Z")), 1);
  // 2026-11-13 is Friday
  assert.equal(getDatabaseDayOfWeek(new Date("2026-11-13T10:00:00Z")), 5);
  // 2026-11-15 is Sunday
  assert.equal(getDatabaseDayOfWeek(new Date("2026-11-15T10:00:00Z")), 7);
});

test("countTodaysSchedules counts only schedules matching the given weekday", () => {
  const friday = new Date("2026-11-13T10:00:00Z"); // day_of_week = 5
  const schedules = [
    { day_of_week: 1 },
    { day_of_week: 5 },
    { day_of_week: "5" },
    { day_of_week: 7 },
  ];

  assert.equal(countTodaysSchedules(schedules, friday), 2);
  assert.equal(countTodaysSchedules([], friday), 0);
  assert.equal(countTodaysSchedules(null, friday), 0);
});
