import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes, createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import { hash as bcrypt } from "bcryptjs";
import { provision, resetTestSchool } from "./support/school.mjs";
import { db } from "../api/dist/db.js";
import { totp, decryptSecret } from "../api/dist/protection.js";

const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3100";
const base = "http://127.0.0.1:4211/api";
const password = "Une phrase de sécurité pour EduBest 2026!";
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function call(
  path,
  { token, method = "GET", body, status = 200, headers = {} } = {},
) {
  const response = await fetch(base + "/" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  assert.equal(response.status, status, path + ": " + JSON.stringify(data));
  return { data, headers: response.headers };
}

test("Durcissement : serveur isolé avec MFA obligatoire et récupération de compte", async (t) => {
  await resetTestSchool();
  const email = "hardening@example.test";
  const { userId } = await provision(email, password);
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("api"),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: "4211",
      API_BIND: "127.0.0.1",
      NODE_ENV: "development",
      REQUIRE_ADMIN_MFA: "true",
    },
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    await db.end();
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      ready = (await fetch(base + "/public/health")).ok;
    } catch {}
    if (ready || child.exitCode !== null) break;
    await delay(200);
  }
  assert.ok(ready, "Serveur de test MFA disponible");
  let owner = (
    await call("auth/login", {
      method: "POST",
      body: { email, password },
      status: 201,
    })
  ).data.token;
  await t.test(
    "MFA : routes métier et invitations bloquées avant activation, configuration accessible",
    async () => {
      await call("auth/me", { token: owner });
      await call("students", { token: owner, status: 428 });
      await call("security/reauthenticate", {
        token: owner,
        method: "POST",
        body: { current: password },
        status: 201,
      });
      const pending = (await call("security/account", { token: owner })).data;
      assert.equal(pending.mfa_enabled, false);
      await call("students", {
        token: owner,
        method: "POST",
        body: { name: "Élève fictif avant activation" },
        status: 428,
      });
      await call("auth/invite", {
        token: owner,
        method: "POST",
        body: { name: "Parent", email: "invited@example.test", role: "PARENT" },
        status: 428,
      });
      const setup = (
        await call("security/mfa/setup", {
          token: owner,
          method: "POST",
          body: { current: password },
          status: 201,
        })
      ).data;
      const enabled = (
        await call("security/mfa/enable", {
          token: owner,
          method: "POST",
          body: {
            current: password,
            code: totp(setup.secret, Math.floor(Date.now() / 30000)),
          },
          status: 201,
        })
      ).data;
      owner = enabled.token;
      await call("students", { token: owner });
      const renewed = (
        await call("security/mfa/recovery", {
          token: owner,
          method: "POST",
          body: { current: password, code: enabled.recovery_codes[0] },
          status: 201,
        })
      ).data.recovery_codes;
      assert.equal(renewed.length, 8);
      const oldCode = (
        await call("auth/login", {
          method: "POST",
          body: { email, password, code: enabled.recovery_codes[1] },
          status: 201,
        })
      ).data;
      assert.equal(oldCode.token, undefined);
      const newCode = (
        await call("auth/login", {
          method: "POST",
          body: { email, password, code: renewed[0] },
          status: 201,
        })
      ).data;
      assert.ok(newCode.token);
      await call("security/mfa/disable", {
        token: owner,
        method: "POST",
        body: { current: password, code: enabled.recovery_codes[0] },
        status: 403,
      });
      await db.query(
        "UPDATE auth_sessions SET reauthenticated_at=now()-interval '11 minutes' WHERE token_hash=$1",
        [digest(owner)],
      );
      await call("auth/invite", {
        token: owner,
        method: "POST",
        body: { name: "Parent", email: "invited@example.test", role: "PARENT" },
        status: 428,
      });
      const created = await call("students", {
        token: owner,
        method: "POST",
        body: { name: "Élève fictif après activation" },
        status: 200,
      });
      assert.ok(created.data.id);
      assert.equal(
        (await call("security/account", { token: owner })).data.mfa_enabled,
        true,
      );
    },
  );
  const parentEmail = "hardening-parent@example.test";
  const legacy = await bcrypt(password, 12);
  const parent = (
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) SELECT gen_random_uuid(),tenant_id,'Parent fictif',$1,$2,'PARENT',true FROM users WHERE id=$3 RETURNING id",
      [parentEmail, legacy, userId],
    )
  ).rows[0].id;
  let parentToken;
  await t.test(
    "Migration bcrypt vers scrypt à la connexion, rotation de session au changement",
    async () => {
      parentToken = (
        await call("auth/login", {
          method: "POST",
          body: { email: parentEmail, password },
          status: 201,
        })
      ).data.token;
      assert.match(
        (
          await db.query("SELECT password_hash FROM users WHERE id=$1", [
            parent,
          ])
        ).rows[0].password_hash,
        /^\$scrypt\$/,
      );
      const changed = await call("auth/password", {
        token: parentToken,
        method: "POST",
        body: { current: password, password: password + " nouveau" },
        status: 201,
      });
      assert.ok(changed.data.token);
      await call("auth/me", { token: parentToken, status: 401 });
      parentToken = changed.data.token;
      await call("auth/me", { token: parentToken });
    },
  );
  await t.test(
    "Lien de vérification incapable de changer le mot de passe ; reset à usage unique",
    async () => {
      const verify = randomBytes(32).toString("base64url");
      await db.query(
        "INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'verify',now()+interval '1 hour')",
        [digest(verify), parent],
      );
      await call("auth/consume", {
        method: "POST",
        body: { token: verify, password },
        status: 400,
      });
      await call("auth/consume", {
        method: "POST",
        body: { token: verify },
        status: 201,
      });
      const reset = randomBytes(32).toString("base64url");
      await db.query(
        "INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'reset',now()+interval '1 hour')",
        [digest(reset), parent],
      );
      await call("auth/consume", {
        method: "POST",
        body: { token: reset, password },
        status: 201,
      });
      await call("auth/consume", {
        method: "POST",
        body: { token: reset, password },
        status: 400,
      });
      await call("auth/me", { token: parentToken, status: 401 });
    },
  );
  await t.test(
    "Récupération limitée par adresse connue ou inconnue, liens chiffrés dans la file",
    async () => {
      for (const target of [parentEmail, "nobody@example.test"]) {
        for (let i = 0; i < 3; i++)
          await call("auth/forgot", {
            method: "POST",
            body: { email: target },
            status: 201,
          });
        const limited = await call("auth/forgot", {
          method: "POST",
          body: { email: target },
          status: 429,
        });
        assert.ok(limited.headers.get("retry-after"));
      }
      const raw = randomBytes(32).toString("base64url");
      const { emailJob } = await import("../api/dist/mail.js");
      // A transaction hides the fixture from the delivery worker while inspecting its encoding.
      const c = await db.connect();
      try {
        await c.query("BEGIN");
        await emailJob(
          "encrypted@example.test",
          "Invitation",
          "https://school.invalid/?token=" + raw,
          c,
        );
        const job = (
          await c.query(
            "SELECT id,payload FROM outbox WHERE recipient='encrypted@example.test'",
          )
        ).rows[0];
        assert.ok(job.payload.encrypted);
        assert.ok(!JSON.stringify(job.payload).includes(raw));
        assert.ok(decryptSecret(job.payload.encrypted, job.id).includes(raw));
        await c.query("ROLLBACK");
      } finally {
        c.release();
      }
    },
  );
  await t.test(
    "Requêtes compressées refusées, cookies malformés rejetés et erreurs traçables",
    async () => {
      await call("auth/me", {
        headers: { Cookie: "edubest_session=" + "x".repeat(1000) },
        status: 401,
      });
      const result = await call("auth/login", {
        method: "POST",
        body: {},
        headers: { "Content-Encoding": "gzip" },
        status: 415,
      });
      assert.match(result.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
      assert.equal(result.data.request_id, result.headers.get("x-request-id"));
      assert.ok(!JSON.stringify(result.data).includes("stack"));
    },
  );
});
