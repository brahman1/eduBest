import { test } from "node:test";
import assert from "node:assert/strict";
import policy from "../shared/review-policy.cjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validateProduction } = require("../api/dist/production.js");
const { assertReviewRoles } = require("../api/dist/review.js");
test("cPanel review allows only its database group and recursively rejects other roles or administrative flags", () => {
  const user = { rolname: "ggcsckht_edubest_revapp", rolcanlogin: true };
  const group = { rolname: "ggcsckht_edubest_review", rolcanlogin: false };
  const verify = (roles) =>
    assertReviewRoles(roles, user.rolname, group.rolname);
  verify([user, group]);
  verify([user]);
  for (const role of [
    { ...group, rolname: "ggcsckht_edubest" },
    { ...group, rolname: "ggcsckht" },
    { ...group, rolcanlogin: true },
    { ...group, rolsuper: true },
    { ...group, rolcreatedb: true },
    { ...group, rolcreaterole: true },
    { ...group, rolreplication: true },
    { ...group, rolbypassrls: true },
  ])
    assert.throws(() => verify([user, role]));
  assert.throws(() => verify([group]));
});
const fixture = () => ({
  EDUBEST_REVIEW_MODE: "true",
  EDUBEST_REVIEW_OUTBOUND: "disabled",
  EDUBEST_DEMO_ENABLED: "false",
  EDUBEST_REVIEW_INSTANCE: "a".repeat(64),
  DATABASE_URL:
    "postgres://edubest_review:synthetic-test-secret@localhost/edubest_review",
});
test("Review refuses the real school database, even with the review flag", () => {
  for (const name of ["edubest", "ggcsckht_edubest", "midad", "edubest_test"]) {
    const env = fixture();
    env.DATABASE_URL = `postgres://edubest_review:synthetic-test-secret@localhost/${name}`;
    assert.throws(() => policy.validateReview(env));
  }
});
test("Review requires its own role, instance and outbound kill switch", () => {
  policy.validateReview(fixture());
  for (const change of [
    {
      DATABASE_URL:
        "postgres://postgres:synthetic-test-secret@localhost/edubest_review",
    },
    { EDUBEST_REVIEW_INSTANCE: "" },
    { EDUBEST_REVIEW_OUTBOUND: "enabled" },
    { SMTP_HOST: "smtp.invalid" },
    { SMTP_USER: "unexpected" },
    { SMTP_PASSWORD: "unexpected" },
    { EXPO_ACCESS_TOKEN: "unexpected" },
  ])
    assert.throws(() => policy.validateReview({ ...fixture(), ...change }));
});
test("Only the exact cPanel account prefix is accepted", () => {
  const env = {
    ...fixture(),
    EDUBEST_CPANEL_ACCOUNT: "ggcsckht",
    DATABASE_URL:
      "postgres://ggcsckht_edubest_revapp:synthetic-test-secret@localhost/ggcsckht_edubest_review",
  };
  policy.validateReview(env);
  assert.throws(() =>
    policy.validateReview({
      ...env,
      DATABASE_URL:
        "postgres://another_edubest_revapp:synthetic-test-secret@localhost/ggcsckht_edubest_review",
    }),
  );
  assert.throws(() =>
    policy.validateReview({ ...env, EDUBEST_CPANEL_ACCOUNT: "another" }),
  );
});
test("A production startup cannot use a review database without the explicit mode", () => {
  assert.throws(
    () =>
      validateProduction({
        ...fixture(),
        EDUBEST_REVIEW_MODE: "false",
        NODE_ENV: "production",
      }),
    /DATABASE_URL/,
  );
});
test("Production keeps admin MFA while review has a separately guarded startup", () => {
  const { adminMfaRequired } = require("../api/dist/security.js");
  const old = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.EDUBEST_REVIEW_MODE;
    assert.equal(adminMfaRequired(), true);
  } finally {
    process.env = old;
  }
});
