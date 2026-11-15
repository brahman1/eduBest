import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import privateEnv from "../ops/octenium/private-env.cjs";
import runtime from "../ops/octenium/runtime-check.cjs";
import { prepare } from "../ops/octenium/control.mjs";

test("Octenium : profil privé sans écrasement et clés distinctes, sans mot de passe par défaut", async () => {
  const folder = await mkdtemp(join(tmpdir(), "edubest-octenium-"));
  const file = join(folder, "api.env");
  try {
    await prepare(file);
    const env = { EDUBEST_TEST_DATABASE: "true", EDUBEST_DEMO_PASSWORD: "old" };
    const { values } = privateEnv.loadPrivateEnvironment(file, env);
    assert.match(values.SECURITY_ENCRYPTION_KEY, /^[0-9a-f]{64}$/);
    const backup = (
      await readFile(values.EDUBEST_BACKUP_KEY_FILE, "utf8")
    ).trim();
    assert.match(backup, /^[0-9a-f]{64}$/);
    assert.notEqual(backup, values.SECURITY_ENCRYPTION_KEY);
    assert.equal(values.SCHOOL_LEGAL_NAME, "KACI Belkacem");
    assert.equal(values.SCHOOL_PRIVACY_EMAIL, "contact@edubest.dz");
    assert.equal(values.EDUBEST_ADMIN_PASSWORD, "");
    assert.equal(values.DATA_RETENTION_POLICY, "");
    assert.equal(values.DATABASE_URL, "");
    assert.equal(env.EDUBEST_TEST_DATABASE, undefined);
    assert.equal(env.EDUBEST_DEMO_PASSWORD, undefined);
    const before = await readFile(file, "utf8");
    await assert.rejects(prepare(file));
    assert.equal(await readFile(file, "utf8"), before);
    if (process.platform !== "win32")
      assert.equal((await stat(file)).mode & 0o077, 0);
  } finally {
    assert.equal(dirname(folder), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith("edubest-octenium-"));
    await rm(folder, { recursive: true, force: true });
  }
});
test("Octenium : refuse un profil privé sous public_html et les profils fictifs", async () => {
  assert.throws(() => privateEnv.privateLocation("relative.env"));
  assert.throws(() =>
    privateEnv.privateLocation(join(tmpdir(), "public_html", "api.env")),
  );
  const folder = await mkdtemp(join(tmpdir(), "edubest-octenium-invalid-"));
  try {
    const file = join(folder, "api.env");
    await writeFile(file, "NODE_ENV=production\nEDUBEST_DEMO_ENABLED=true\n", {
      mode: 0o600,
    });
    assert.throws(() => privateEnv.loadPrivateEnvironment(file, {}));
  } finally {
    assert.equal(dirname(folder), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith("edubest-octenium-invalid-"));
    await rm(folder, { recursive: true, force: true });
  }
});
test("Octenium : la version Node est vérifiée avant le démarrage", () => {
  for (const version of ["22.23.3", "22.23.4", "22.24.0"])
    assert.doesNotThrow(() => runtime.requireRuntime(version));
  for (const version of ["20.19.0", "22.14.0", "22.23.2", "24.0.0"])
    assert.throws(() => runtime.requireRuntime(version));
});
