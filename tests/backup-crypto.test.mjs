import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { mkdtemp, readFile, writeFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptDump, authenticatedDump } from "../scripts/backup-crypto.mjs";
test("Sauvegardes : chiffrement authentifié, altération et mauvaise clé refusées avant restauration", async () => {
  const folder = await mkdtemp(join(tmpdir(), "edubest-backup-test-"));
  const file = join(folder, "test.edubest-backup");
  const key = randomBytes(32),
    plain = Buffer.from("PGDMP\0" + "données fictives privées".repeat(1000));
  try {
    await encryptDump(Readable.from([plain]), file, key);
    const encrypted = await readFile(file);
    assert.ok(!encrypted.includes(Buffer.from("données fictives")));
    const dump = await authenticatedDump(file, key);
    try {
      assert.deepEqual(await readFile(dump.path), plain);
    } finally {
      await dump.dispose();
    }
    await assert.rejects(authenticatedDump(file, randomBytes(32)));
    for (const index of [50, 200, encrypted.length - 1]) {
      const changed = Buffer.from(encrypted);
      changed[index] ^= 1;
      await writeFile(join(folder, "bad"), changed);
      await assert.rejects(authenticatedDump(join(folder, "bad"), key));
    }
    await writeFile(join(folder, "bad"), encrypted.subarray(0, 30));
    await assert.rejects(authenticatedDump(join(folder, "bad"), key));
  } finally {
    await rm(file, { force: true });
    await rm(join(folder, "bad"), { force: true });
    await rmdir(folder);
  }
});
