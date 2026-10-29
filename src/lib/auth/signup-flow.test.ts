import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  afterSignInPath,
  afterSignUpPath,
  intentQuery,
  readSignupIntent,
  resumeOnboardingPath,
  safeRelativePath,
  signedInAuthPageRedirect,
} from "./signup-flow.ts";

const q = (s: string) => new URLSearchParams(s);

describe("safeRelativePath", () => {
  it("accepts same-site paths and reduces absolute URLs", () => {
    assert.equal(safeRelativePath("/academy/x/join?role=teacher"), "/academy/x/join?role=teacher");
    assert.equal(safeRelativePath("https://evil.example/academy/x"), "/academy/x");
  });

  it("rejects open redirects", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "javascript:alert(1)", "evil.example", ""]) {
      assert.equal(safeRelativePath(bad), null, bad);
    }
  });
});

describe("readSignupIntent", () => {
  it("normalizes roles and validates tenant and code", () => {
    const intent = readSignupIntent(q("role=tutor&tenant=Lusaka-ICT&code=123456"));
    assert.equal(intent.role, "company_admin");
    assert.equal(intent.tenant, "lusaka-ict");
    assert.equal(intent.code, "123456");
    const bad = readSignupIntent(q("role=super_admin&tenant=../x&code=abc"));
    assert.deepEqual([bad.role, bad.tenant, bad.code], [null, null, null]);
  });

  it("reads plain objects (Next searchParams)", () => {
    assert.equal(readSignupIntent({ role: "student", tenant: ["abc"] }).tenant, "abc");
  });
});

describe("afterSignUpPath", () => {
  it("sends academy owners to the launch page", () => {
    assert.equal(afterSignUpPath(readSignupIntent(q("role=company_admin"))), "/launch-your-academy");
  });

  it("sends invited students and teachers to onboarding for that academy", () => {
    assert.equal(afterSignUpPath(readSignupIntent(q("role=student&tenant=abc"))), "/onboarding?role=student&tenant=abc");
    assert.equal(
      afterSignUpPath(readSignupIntent(q("role=teacher&tenant=abc&code=123456"))),
      "/onboarding?role=teacher&tenant=abc&code=123456"
    );
    // A student link never forwards a staff code.
    assert.equal(
      afterSignUpPath(readSignupIntent(q("role=student&tenant=abc&code=123456"))),
      "/onboarding?role=student&tenant=abc"
    );
  });

  it("derives the academy from the return path", () => {
    assert.equal(
      afterSignUpPath(readSignupIntent(q("role=student&redirect_url=/academy/abc/classroom"))),
      "/onboarding?role=student&tenant=abc&next=%2Facademy%2Fabc%2Fclassroom"
    );
  });
});

describe("afterSignInPath", () => {
  it("routes existing accounts through the join page", () => {
    assert.equal(afterSignInPath(readSignupIntent(q("role=student&tenant=abc"))), "/academy/abc/join");
    assert.equal(
      afterSignInPath(readSignupIntent(q("role=teacher&tenant=abc&code=123456"))),
      "/academy/abc/join?role=teacher&code=123456"
    );
    assert.equal(afterSignInPath(readSignupIntent(q("role=company_admin&tenant=abc"))), "/launch-your-academy");
  });

  it("keeps a return path", () => {
    assert.equal(
      afterSignInPath(readSignupIntent(q("redirect_url=%2Fcourses%2Fai"))),
      "/after-sign-in?redirect_url=%2Fcourses%2Fai"
    );
    assert.equal(afterSignInPath(readSignupIntent(q(""))), "/after-sign-in");
  });
});

describe("signedInAuthPageRedirect", () => {
  it("only intercepts the root auth pages", () => {
    assert.equal(signedInAuthPageRedirect("/sign-up", q("role=company_admin")), "/launch-your-academy");
    assert.equal(signedInAuthPageRedirect("/sign-in/", q("")), "/after-sign-in");
    for (const sub of [
      "/sign-up/sso-callback",
      "/sign-in/sso-callback",
      "/sign-up/verify-email-address",
      "/sign-in/factor-one",
      "/sign-up/continue",
    ]) {
      assert.equal(signedInAuthPageRedirect(sub, q("role=company_admin")), null, sub);
    }
  });
});

describe("resumeOnboardingPath", () => {
  it("resumes an interrupted sign-up", () => {
    assert.equal(resumeOnboardingPath({ signupRole: "company_admin" }), "/launch-your-academy");
    assert.equal(
      resumeOnboardingPath({ signupRole: "student", signupTenant: "abc" }),
      "/onboarding?role=student&tenant=abc"
    );
    assert.equal(resumeOnboardingPath({ signupTenant: "../x" }), "/onboarding");
    assert.equal(resumeOnboardingPath(null), "/onboarding");
  });
});

describe("intentQuery", () => {
  it("carries the intent with overrides", () => {
    const intent = readSignupIntent(q("tenant=abc&redirect_url=/academy/abc/join"));
    assert.equal(
      intentQuery(intent, { role: "student" }),
      "role=student&tenant=abc&redirect_url=%2Facademy%2Fabc%2Fjoin"
    );
  });
});
