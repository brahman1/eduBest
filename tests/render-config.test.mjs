import { test } from "node:test";
import assert from "node:assert/strict";
import { demoConfig } from "../scripts/demo-config.mjs";
test("Les jeux fictifs refusent une production ordinaire et une base distante non autorisée", () => {
  assert.throws(() => demoConfig({ NODE_ENV: "production" }));
  assert.throws(() =>
    demoConfig({ DATABASE_URL: "postgres://user:pass@example.com/db" }),
  );
  assert.equal(demoConfig({ EDUBEST_DEMO_ENABLED: "true" }).cloud, false);
});
test("Render ne peut plus activer une démonstration en production", () => {
  const env = {
    RENDER: "true",
    NODE_ENV: "production",
    EDUBEST_DEMO_ENABLED: "true",
    DATABASE_URL: "postgres://user:pass@internal-render/db",
    EDUBEST_DEMO_PASSWORD: "a-test-password-with-24-chars",
  };
  assert.throws(() => demoConfig(env));
  assert.throws(() => demoConfig({ ...env, RENDER: "false" }));
  assert.throws(() =>
    demoConfig({ ...env, EDUBEST_DEMO_PASSWORD: "EduBest-Local-2026!" }),
  );
  assert.throws(() => demoConfig({ ...env, DATABASE_URL: undefined }));
});
