import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../api/dist/db.js";
import { resetTestSchool, provision, closeTestDb } from "./support/school.mjs";

const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4206/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3120";
const password = "Family-Fields-EduBest-2026!";
async function call(path, auth = {}, method = "GET", body, expected = 200) {
  const response = await fetch(base + "/" + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, ...auth },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, method + " " + path);
  return { data, headers: response.headers };
}
async function login(email, mode = "token") {
  const response = await call(
    "auth/login",
    {},
    "POST",
    { email, password, session_mode: mode },
    201,
  );
  if (mode === "cookie") {
    assert.equal(response.data.token, undefined);
    return { Cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  assert.ok(response.data.token);
  return { Authorization: "Bearer " + response.data.token };
}
function noTeacherPay(data) {
  if (!data || typeof data !== "object") return;
  for (const [key, value] of Object.entries(data)) {
    assert.ok(
      !["pay_mode", "pay_value", "pay_percent_bp"].includes(key),
      "Champ de rémunération transmis : " + key,
    );
    noTeacherPay(value);
  }
}

test("Familles : champs publics, refus des accès étrangers et maintien des droits métier", async (t) => {
  t.after(closeTestDb);
  await resetTestSchool();
  const ownerEmail = "family-owner@example.test";
  const owner = await provision(ownerEmail, password);
  const admin = await login(ownerEmail);
  const people = {};
  for (const [key, role] of [
    ["parent", "PARENT"],
    ["pupil", "STUDENT"],
    ["otherParent", "PARENT"],
    ["otherPupil", "STUDENT"],
    ["teacher", "TEACHER"],
    ["cashier", "CASHIER"],
    ["manager", "MANAGER"],
  ]) {
    const id = randomUUID(),
      email = `family-${key.toLowerCase()}@example.test`;
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) SELECT $1,tenant_id,$2,$3,password_hash,$4,true FROM users WHERE id=$5",
      [id, key, email, role, owner.userId],
    );
    people[key] = { id, email };
  }
  async function create(path, body) {
    return (await call(path, admin, "POST", body)).data.id;
  }
  const ownStudent = await create("students", {
    name: "Dossier lié",
    parent_id: people.parent.id,
    user_id: people.pupil.id,
  });
  const otherStudent = await create("students", {
    name: "Autre dossier",
    parent_id: people.otherParent.id,
    user_id: people.otherPupil.id,
  });
  const group = await create("groups", {
    name: "Groupe partagé",
    subject: "Maths",
    teacher_id: people.teacher.id,
    capacity: 10,
    fee_centimes: 90000,
    pay_mode: "hour",
    pay_value: 123456,
  });
  const foreignGroup = await create("groups", {
    name: "Autre groupe",
    subject: "Langues",
    teacher_id: people.teacher.id,
    capacity: 10,
    fee_centimes: 80000,
    pay_mode: "session",
    pay_value: 654321,
  });
  for (const [gid, sid] of [
    [group, ownStudent],
    [group, otherStudent],
    [foreignGroup, otherStudent],
  ])
    await call(`groups/${gid}/enroll`, admin, "POST", { student_id: sid });
  const sessionDay = new Date(Date.now() + 2 * 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Africa/Algiers" },
  );
  const endDay = new Date(Date.now() + 3 * 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Africa/Algiers" },
  );
  const lesson = await create("sessions", {
    group_id: group,
    starts_at: `${sessionDay}T09:00:00+01:00`,
    ends_at: `${sessionDay}T10:00:00+01:00`,
    notes: "Apporter son cahier",
  });
  const foreignLesson = await create("sessions", {
    group_id: foreignGroup,
    starts_at: `${sessionDay}T11:00:00+01:00`,
    ends_at: `${sessionDay}T12:00:00+01:00`,
  });
  await create("invoices", {
    student_id: ownStudent,
    group_id: group,
    label: "Janvier",
    amount_centimes: 90000,
    due_date: "2031-01-05",
  });
  await create("invoices", {
    student_id: otherStudent,
    group_id: foreignGroup,
    label: "Autre échéance",
    amount_centimes: 80000,
    due_date: "2031-01-05",
  });
  for (const person of [people.parent, people.pupil])
    for (const mode of ["cookie", "token"]) {
      await t.test(
        `${person.email.includes("parent") ? "Parent" : "Élève"} — session ${mode}`,
        async () => {
          const auth = await login(person.email, mode);
          const groups = (await call("groups", auth)).data;
          assert.deepEqual(
            groups.map((g) => g.id),
            [group],
          );
          assert.equal(groups[0].fee_centimes, 90000);
          assert.equal(groups[0].teacher_name, "teacher");
          const sessions = (await call("sessions", auth)).data;
          assert.deepEqual(
            sessions.map((s) => s.id),
            [lesson],
          );
          assert.equal(sessions[0].notes, "Apporter son cahier");
          const dated = (
            await call(`sessions?from=${sessionDay}&to=${endDay}`, auth)
          ).data;
          const dashboard = (await call("dashboard", auth)).data;
          assert.equal(dashboard.upcoming[0].id, lesson);
          const invoices = (await call("invoices", auth)).data;
          assert.deepEqual(
            invoices.map((i) => i.student_id),
            [ownStudent],
          );
          const exported = (await call("privacy/export", auth)).data;
          assert.deepEqual(
            exported.students.map((s) => s.id),
            [ownStudent],
          );
          noTeacherPay({
            groups,
            sessions,
            dated,
            dashboard,
            invoices,
            exported,
          });
          assert.deepEqual(
            (await call(`groups/${group}/students`, auth)).data.map(
              (s) => s.id,
            ),
            [ownStudent],
          );
          assert.deepEqual(
            (await call(`sessions/${lesson}/attendance`, auth)).data.map(
              (s) => s.student_id,
            ),
            [ownStudent],
          );
          await call(
            `groups/${foreignGroup}/students`,
            auth,
            "GET",
            undefined,
            404,
          );
          await call(
            `sessions/${foreignLesson}/attendance`,
            auth,
            "GET",
            undefined,
            404,
          );
          for (const path of [
            "users",
            "settings",
            "cash",
            "payroll",
            "privacy/admin",
          ])
            await call(path, auth, "GET", undefined, 403);
          for (const path of [
            "students",
            "groups",
            "sessions",
            "invoices",
            "payments",
            "auth/invite",
          ])
            await call(path, auth, "POST", {}, 403);
          await call("auth/logout", auth, "POST", {}, 201);
        },
      );
    }
  await t.test(
    "Direction, responsable, caisse et enseignant conservent les champs utiles",
    async () => {
      for (const auth of [
        admin,
        await login(people.manager.email),
        await login(people.cashier.email),
        await login(people.teacher.email),
      ]) {
        const groups = (await call("groups", auth)).data;
        assert.equal(groups.find((g) => g.id === group).pay_value, 123456);
        assert.equal(
          (await call("sessions", auth)).data.find((l) => l.id === lesson)
            .pay_mode,
          "hour",
        );
      }
    },
  );
});
