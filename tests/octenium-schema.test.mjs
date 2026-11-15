import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { db, migrate } from "../api/dist/db.js";

test("Octenium : import réel du schéma vide, migrations reconnues et refus du réimport", async (t) => {
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "edubest_test",
  );
  assert.equal(process.env.EDUBEST_TEST_DATABASE, "true");
  t.after(async () => {
    await migrate();
    await db.end();
  });
  const sql = await readFile(
    new URL("../ops/octenium/database/schema-empty.sql", import.meta.url),
    "utf8",
  );
  const client = await db.connect();
  try {
    // Explicit whole-schema fixture reset is restricted to edubest_test above.
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await assert.rejects(
      client.query(sql),
      /Explicit test database activation required/,
    );
    await client.query("ROLLBACK");
    await client.query("SET edubest.allow_test_database='true'");
    await client.query(sql);
    assert.equal(
      (await client.query("SELECT count(*)::int AS n FROM schema_migrations"))
        .rows[0].n,
      9,
    );
    for (const table of [
      "tenants",
      "users",
      "students",
      "groups",
      "invoices",
      "payments",
      "registration_requests",
    ])
      assert.equal(
        (await client.query("SELECT count(*)::int AS n FROM " + table)).rows[0]
          .n,
        0,
      );
    await assert.rejects(client.query(sql), /Database is not empty/);
    await client.query("ROLLBACK");
  } finally {
    await client.query("ROLLBACK");
    await client.query("RESET edubest.allow_test_database");
    client.release();
  }
  await migrate();
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM schema_migrations")).rows[0]
      .n,
    9,
  );
});
