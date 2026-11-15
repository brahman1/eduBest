import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../api/dist/db.js";
import { initializeSchool } from "../api/dist/initialize.js";
import { provision, resetTestSchool } from "./support/school.mjs";
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4200/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3100";
const password = "EduBest-Single-School-2026!";
async function post(path, body, token) {
  return fetch(base + "/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
}
test("EduBest : une seule école, initialisation privée et connexion sans sélecteur", async (t) => {
  t.after(() => db.end());
  await resetTestSchool();
  const results = await Promise.allSettled(
    [1, 2].map((i) => provision(`direction${i}@example.test`, password)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.query("SELECT count(*) FROM tenants")).rows[0].count,
    1,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO tenants(id,name,slug) VALUES($1,'Autre école','other')",
      [randomUUID()],
    ),
    (e) => e.code === "23514",
  );
  await assert.rejects(
    db.query(
      "INSERT INTO tenants(id,name,slug) VALUES($1,'Autre école','edubest')",
      [randomUUID()],
    ),
    (e) => e.code === "23505",
  );
  await assert.rejects(
    db.query("UPDATE tenants SET slug='other'"),
    (e) => e.code === "23514",
  );
  const user = (
    await db.query("SELECT email,password_hash FROM users WHERE role='OWNER'")
  ).rows[0];
  await assert.rejects(
    initializeSchool({
      email: user.email,
      name: "Remplacement",
      password: "Replacement-Password-2026!",
    }),
  );
  assert.equal(
    (
      await db.query("SELECT password_hash FROM users WHERE email=$1", [
        user.email,
      ])
    ).rows[0].password_hash,
    user.password_hash,
  );
  const login = await post("auth/login", { email: user.email, password });
  assert.equal(login.status, 201);
  const { token } = await login.json();
  assert.ok(token);
  assert.equal(
    (await post("auth/login", { slug: "other", email: user.email, password }))
      .status,
    400,
  );
  assert.equal(
    (await post("auth/forgot", { slug: "other", email: user.email })).status,
    400,
  );
  assert.equal(
    (
      await post(
        "auth/register",
        {
          slug: "other",
          school: "Autre école",
          name: "Test",
          email: "other@example.test",
          password,
        },
        token,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await post(
        "public/contact",
        {
          name: "Test",
          email: "other@example.test",
          school: "Autre école",
          message: "Ouvrir une école",
        },
        token,
      )
    ).status,
    404,
  );
  const me = await fetch(base + "/auth/me", {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal((await me.json()).slug, "edubest");
});
