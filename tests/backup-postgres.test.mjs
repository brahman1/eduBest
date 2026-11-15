import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { db, migrate } from "../api/dist/db.js";
import { backup, restore } from "../scripts/backup.mjs";
test("PostgreSQL : sauvegarde chiffrée et restauration réelle uniquement dans edubest_test", async (t) => {
  const current = (await db.query("SELECT current_database() AS name")).rows[0]
    .name;
  assert.equal(current, "edubest_test");
  assert.equal(process.env.EDUBEST_TEST_DATABASE, "true");
  t.after(async () => {
    await db.query("CREATE SCHEMA IF NOT EXISTS public");
    await migrate();
    await db.end();
  });
  const dir = resolve(".local/backup-verification");
  await mkdir(dir, { recursive: true });
  const keyFile = resolve(dir, "key"),
    file = resolve(dir, "test.edubest-backup");
  await writeFile(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  process.env.EDUBEST_BACKUP_KEY_FILE = keyFile;
  process.env.EDUBEST_RESTORE_DATABASE_URL = process.env.DATABASE_URL;
  if (process.platform === "win32")
    process.env.EDUBEST_PG_BIN = "C:/Program Files/PostgreSQL/17/bin";
  const value = randomBytes(20).toString("hex");
  await db.query(
    "CREATE TABLE IF NOT EXISTS release_backup_probe(value text NOT NULL)",
  );
  await db.query("TRUNCATE release_backup_probe");
  await db.query("INSERT INTO release_backup_probe(value) VALUES($1)", [value]);
  const before = Number(
    (await db.query("SELECT count(*) AS n FROM users")).rows[0].n,
  );
  try {
    await backup(file);
    await assert.rejects(
      backup(file),
      "Une sauvegarde existante ne doit pas être écrasée",
    );
    await assert.rejects(restore(file), /contient déjà/);
    // Explicit fixture reset: current_database and activation flag verified above.
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await restore(file);
    assert.equal(
      (await db.query("SELECT value FROM release_backup_probe")).rows[0].value,
      value,
    );
    assert.equal(
      Number((await db.query("SELECT count(*) AS n FROM users")).rows[0].n),
      before,
    );
    await db.query("DROP TABLE release_backup_probe");
  } finally {
    await rm(file, { force: true });
    await rm(keyFile, { force: true });
  }
});
