import { test } from "node:test";
import assert from "node:assert/strict";
import policy from "../shared/database-policy.cjs";
import { validateProduction } from "../api/dist/production.js";

test("cPanel : seul le préfixe de compte explicitement configuré est accepté", () => {
  const env = { EDUBEST_CPANEL_ACCOUNT: "school01" };
  for (const name of [
    "edubest",
    "edubest_production",
    "school01_edubest",
    "school01_edubest_production",
  ]) {
    assert.equal(policy.productionDatabaseName(name, env), true);
    assert.equal(policy.backupDatabaseName(name, env), true);
    assert.equal(policy.restoreDatabaseName(name, env), false);
  }
  for (const name of [
    "midad",
    "school01_midad",
    "midad_edubest",
    "other_edubest",
    "school01_edubest_test",
    "edubest_test",
    "edubest_restore_saved",
    "school01_edubest_restore_saved",
  ]) {
    assert.equal(policy.productionDatabaseName(name, env), false, name);
    assert.equal(policy.backupDatabaseName(name, env), false, name);
  }
  assert.equal(policy.productionDatabaseName("school01_edubest", {}), false);
  assert.equal(
    policy.productionDatabaseName("edubest_edubest", {
      EDUBEST_CPANEL_ACCOUNT: "edubest",
    }),
    true,
  );
  assert.equal(
    policy.productionDatabaseName("edubest_production", {
      EDUBEST_CPANEL_ACCOUNT: "edubest",
    }),
    true,
  );
  assert.equal(
    policy.restoreDatabaseName("edubest_restore_check", {
      EDUBEST_CPANEL_ACCOUNT: "edubest",
    }),
    true,
  );
  for (const prefix of [
    "school-01",
    "../school01",
    "school01_",
    "a".repeat(17),
    "midad",
  ])
    assert.equal(policy.account({ EDUBEST_CPANEL_ACCOUNT: prefix }), null);
});

test("cPanel : les restaurations restent isolées et les fixtures explicitement activées", () => {
  const env = { EDUBEST_CPANEL_ACCOUNT: "school01" };
  assert.equal(
    policy.restoreDatabaseName("school01_edubest_restore_20261022", env),
    true,
  );
  assert.equal(
    policy.restoreDatabaseName("other_edubest_restore_20261022", env),
    false,
  );
  assert.equal(
    policy.restoreDatabaseName("school01_edubest_restore_", env),
    false,
  );
  assert.equal(policy.backupDatabaseName("edubest_test", env), false);
  assert.equal(policy.restoreDatabaseName("edubest_test", env), false);
  assert.equal(
    policy.backupDatabaseName("edubest_test", {
      ...env,
      EDUBEST_TEST_DATABASE: "true",
    }),
    true,
  );
  assert.equal(
    policy.restoreDatabaseName("edubest_test", {
      ...env,
      EDUBEST_TEST_DATABASE: "true",
    }),
    true,
  );
});

test("Production : une base cPanel est reconnue sans contourner les autres contrôles", () => {
  try {
    validateProduction({
      NODE_ENV: "production",
      EDUBEST_CPANEL_ACCOUNT: "school01",
      DATABASE_URL:
        "postgres://school01:0123456789abcdefABC@localhost/school01_edubest",
    });
    assert.fail("La configuration incomplète doit être refusée");
  } catch (error) {
    assert.match(error.message, /SCHOOL_LEGAL_NAME/);
    assert.ok(!error.message.includes("DATABASE_URL"));
  }
});
