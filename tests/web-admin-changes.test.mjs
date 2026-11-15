import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../api/dist/db.js";
import { provision, resetTestSchool, closeTestDb } from "./support/school.mjs";
import { password, passwordGuidance } from "../shared/dist/index.js";
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4219/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3120";
const initial = "Phrase de recette web EduBest 2026!";
async function call(path, token, method = "GET", body, status = 200) {
  const r = await fetch(`${base}/${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(d)}`);
  return d;
}
test("Mot de passe : 8 caractères acceptés, limites et consignes cohérentes", () => {
  assert.equal(password.safeParse("Abc42!?z").success, true);
  assert.equal(password.safeParse("Abc42!?").success, false);
  assert.equal(password.safeParse("Password1!").success, false);
  assert.equal(password.safeParse("aaaaaaaa").success, false);
  assert.equal(password.safeParse("x".repeat(129)).success, false);
  assert.equal(password.safeParse("مدرسةجميلة").success, true);
  assert.match(passwordGuidance.fr, /8 à 128/);
});
test("Web admin : suppressions sûres et mot de passe court sur API", async (t) => {
  await resetTestSchool();
  t.after(closeTestDb);
  const owner = await provision("web-owner@example.test", initial),
    tenant = owner.schoolId;
  const login = async (email, pw = initial) =>
    (await call("auth/login", null, "POST", { email, password: pw }, 201))
      .token;
  const admin = await login("web-owner@example.test"),
    users = {};
  for (const role of ["MANAGER", "TEACHER", "PARENT", "STUDENT"]) {
    const id = randomUUID(),
      email = `web-${role.toLowerCase()}@example.test`;
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) SELECT $1,tenant_id,$2,$3,password_hash,$4,true FROM users WHERE id=$5",
      [id, role, email, role, owner.userId],
    );
    users[role] = { id, email, token: await login(email) };
  }
  const student = randomUUID(),
    group = randomUUID(),
    past = randomUUID(),
    future = randomUUID(),
    single = randomUUID(),
    invoice = randomUUID();
  await db.query(
    "INSERT INTO students(id,tenant_id,name,parent_id,user_id) VALUES($1,$2,'Élève test',$3,$4)",
    [student, tenant, users.PARENT.id, users.STUDENT.id],
  );
  await db.query(
    "INSERT INTO groups(id,tenant_id,name,subject,teacher_id,capacity,fee_centimes,pay_value) VALUES($1,$2,'Cours test','Maths',$3,20,100000,50000)",
    [group, tenant, users.TEACHER.id],
  );
  await db.query(
    "INSERT INTO enrollments(tenant_id,group_id,student_id) VALUES($1,$2,$3)",
    [tenant, group, student],
  );
  for (const [id, start, end, status] of [
    [past, "now()-interval '3 hours'", "now()-interval '2 hours'", "completed"],
    [
      future,
      "now()+interval '2 days'",
      "now()+interval '2 days 1 hour'",
      "scheduled",
    ],
    [
      single,
      "now()+interval '3 days'",
      "now()+interval '3 days 1 hour'",
      "scheduled",
    ],
  ])
    await db.query(
      `INSERT INTO lessons(id,tenant_id,group_id,teacher_id,starts_at,ends_at,status,pay_value) VALUES($1,$2,$3,$4,${start},${end},$5,50000)`,
      [id, tenant, group, users.TEACHER.id, status],
    );
  await db.query(
    "INSERT INTO attendance(tenant_id,lesson_id,student_id,status,updated_by) VALUES($1,$2,$3,'present',$4)",
    [tenant, past, student, owner.userId],
  );
  await db.query(
    "INSERT INTO invoices(id,tenant_id,student_id,group_id,label,amount_centimes,due_date) VALUES($1,$2,$3,$4,'Frais',100000,current_date)",
    [invoice, tenant, student, group],
  );
  const month = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" })
    .slice(0, 7);
  await t.test(
    "Les rôles non administrateurs ne peuvent rien supprimer",
    async () => {
      for (const role of ["STUDENT", "PARENT", "TEACHER"])
        for (const path of [
          `groups/${group}`,
          `sessions/${single}`,
          `users/${users.TEACHER.id}`,
        ])
          await call(path, users[role].token, "DELETE", undefined, 403);
    },
  );
  await t.test(
    "Un MANAGER supprime une séance future, sans effacer la présence passée",
    async () => {
      await call(
        "security/reauthenticate",
        users.MANAGER.token,
        "POST",
        { current: initial },
        201,
      );
      await call(`sessions/${single}`, users.MANAGER.token, "DELETE");
      assert.equal(
        (await db.query("SELECT status FROM lessons WHERE id=$1", [single]))
          .rows[0].status,
        "cancelled",
      );
      await call(`sessions/${past}`, admin, "DELETE", undefined, 409);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM attendance WHERE lesson_id=$1",
            [past],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "Retirer un professeur révoque son accès et garde sa rémunération",
    async () => {
      const before = (await call(`payroll?month=${month}`, admin)).find(
        (r) => r.id === users.TEACHER.id,
      );
      assert.equal(before.earned_centimes, 50000);
      await call(`users/${users.TEACHER.id}`, users.MANAGER.token, "DELETE");
      assert.equal(
        (
          await db.query("SELECT active FROM users WHERE id=$1", [
            users.TEACHER.id,
          ])
        ).rows[0].active,
        false,
      );
      assert.equal(
        (await db.query("SELECT teacher_id FROM groups WHERE id=$1", [group]))
          .rows[0].teacher_id,
        null,
      );
      assert.equal(
        (await db.query("SELECT teacher_id FROM lessons WHERE id=$1", [future]))
          .rows[0].teacher_id,
        null,
      );
      assert.equal(
        (await db.query("SELECT teacher_id FROM lessons WHERE id=$1", [past]))
          .rows[0].teacher_id,
        users.TEACHER.id,
      );
      await call("auth/me", users.TEACHER.token, "GET", undefined, 401);
      const archived = (await call(`payroll?month=${month}`, admin)).find(
        (r) => r.id === users.TEACHER.id,
      );
      assert.equal(archived.earned_centimes, 50000);
      assert.equal(archived.active, false);
      await call("payroll", admin, "POST", {
        teacher_id: users.TEACHER.id,
        month,
        amount_centimes: 10000,
        reference: "Solde historique",
      });
      assert.equal(
        (await call(`payroll?month=${month}`, admin)).find(
          (r) => r.id === users.TEACHER.id,
        ).balance_centimes,
        40000,
      );
      await call(
        `users/${owner.userId}`,
        users.MANAGER.token,
        "DELETE",
        undefined,
        404,
      );
      assert.equal(
        (await db.query("SELECT active FROM users WHERE id=$1", [owner.userId]))
          .rows[0].active,
        true,
      );
    },
  );
  await t.test(
    "Retirer un cours annule le futur, conserve factures et historique, interdit sa réactivation par séance",
    async () => {
      await call(`groups/${group}`, admin, "DELETE");
      assert.equal(
        (await db.query("SELECT active FROM groups WHERE id=$1", [group]))
          .rows[0].active,
        false,
      );
      assert.equal(
        (await db.query("SELECT status FROM lessons WHERE id=$1", [future]))
          .rows[0].status,
        "cancelled",
      );
      assert.equal(
        (await db.query("SELECT status FROM lessons WHERE id=$1", [past]))
          .rows[0].status,
        "completed",
      );
      assert.equal(
        (
          await db.query("SELECT amount_centimes FROM invoices WHERE id=$1", [
            invoice,
          ])
        ).rows[0].amount_centimes,
        100000,
      );
      assert.equal(
        (await call("groups", admin)).some((r) => r.id === group),
        false,
      );
      await call(
        `sessions/${future}/status`,
        admin,
        "POST",
        { status: "scheduled" },
        409,
      );
      await call(`groups/${group}`, admin, "DELETE");
    },
  );
  await t.test(
    "Le serveur accepte un vrai changement de mot de passe à 8 caractères",
    async () => {
      await call(
        "auth/password",
        users.STUDENT.token,
        "POST",
        { current: initial, password: "Abc42!?z" },
        201,
      );
      assert.ok(await login(users.STUDENT.email, "Abc42!?z"));
    },
  );
});
