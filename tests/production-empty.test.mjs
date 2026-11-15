import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../api/dist/db.js";
import { resetTestSchool, provision } from "./support/school.mjs";
test("Initialisation réelle : une direction uniquement et aucun dossier scolaire ou financier", async (t) => {
  t.after(() => db.end());
  await resetTestSchool();
  await provision(
    "clean-bootstrap@example.test",
    "Production-Setup-Unit-2026!",
  );
  assert.equal(
    (await db.query("SELECT count(*) FROM tenants")).rows[0].count,
    1,
  );
  assert.equal(
    (await db.query("SELECT count(*) FROM users WHERE role='OWNER'")).rows[0]
      .count,
    1,
  );
  assert.equal((await db.query("SELECT count(*) FROM users")).rows[0].count, 1);
  for (const table of [
    "students",
    "groups",
    "enrollments",
    "lessons",
    "attendance",
    "invoices",
    "payments",
    "announcements",
    "notifications",
    "outbox",
  ])
    assert.equal(
      (await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
      0,
      table,
    );
});
