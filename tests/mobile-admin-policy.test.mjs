import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { password, passwordGuidance } from "../shared/dist/index.js";

const built = await build({
  entryPoints: [
    fileURLToPath(new URL("../mobile/admin-policy.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const module = { exports: {} };
vm.runInNewContext(built.outputFiles[0].text, {
  module,
  exports: module.exports,
  require: (await import("node:module")).createRequire(import.meta.url),
});
const { canRemoveSession, canRemoveTeacher } = module.exports;
const now = Date.parse("2026-10-27T10:00:00Z");

test("Mobile : suppressions réservées aux administrateurs et aux séances futures non commencées", () => {
  for (const role of ["OWNER", "MANAGER"]) {
    assert.equal(
      canRemoveSession(
        role,
        { status: "scheduled", starts_at: "2026-10-27T11:00:00Z" },
        now,
      ),
      true,
    );
    for (const row of [
      { status: "completed", starts_at: "2026-10-28T10:00:00Z" },
      { status: "cancelled", starts_at: "2026-10-28T10:00:00Z" },
      { status: "scheduled", starts_at: "2026-10-27T10:00:00Z" },
      { status: "scheduled", starts_at: "invalid" },
    ])
      assert.equal(canRemoveSession(role, row, now), false);
  }
  for (const role of ["TEACHER", "PARENT", "STUDENT", "CASHIER"]) {
    assert.equal(
      canRemoveSession(
        role,
        { status: "scheduled", starts_at: "2026-10-28T11:00:00Z" },
        now,
      ),
      false,
    );
    assert.equal(
      canRemoveTeacher(role, { role: "TEACHER", active: true }),
      false,
    );
  }
});

test("Mobile : retrait limité aux comptes enseignants actifs", () => {
  assert.equal(
    canRemoveTeacher("MANAGER", { role: "TEACHER", active: true }),
    true,
  );
  for (const role of ["OWNER", "MANAGER", "PARENT", "STUDENT", "CASHIER"])
    assert.equal(canRemoveTeacher("OWNER", { role, active: true }), false);
  assert.equal(
    canRemoveTeacher("OWNER", { role: "TEACHER", active: false }),
    false,
  );
});

test("Mobile : règle commune de mot de passe à 8 caractères, sans imposer une majuscule", () => {
  assert.equal(password.safeParse("ecole7!?").success, true);
  assert.equal(password.safeParse("ecol7!?").success, false);
  assert.equal(password.safeParse("aaaaaaaa").success, false);
  assert.equal(password.safeParse("Password123!").success, false);
  assert.match(passwordGuidance.fr, /8/);
  assert.match(passwordGuidance.ar, /8/);
});
