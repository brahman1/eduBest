import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "../api/dist/db.js";
import { provision, resetTestSchool, closeTestDb } from "./support/school.mjs";

const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4206/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3100";
const mail = process.env.TEST_MAIL_URL ?? "http://127.0.0.1:8038";
const password = "Recette-Inscription-2026!";

async function call(
  path,
  status,
  { body, session, method = body ? "POST" : "GET", native = false } = {},
) {
  const response = await fetch(`${base}/${path}`, {
    method,
    signal: AbortSignal.timeout(12000),
    headers: {
      "Content-Type": "application/json",
      ...(native ? { Authorization: "Bearer mobile" } : { Origin: origin }),
      ...(session ? { Authorization: "Bearer " + session } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${data.message ?? response.status}`,
  );
  return data;
}

async function mailToken(address, key) {
  for (let i = 0; i < 40; i++) {
    const response = await fetch(mail + "/api/v1/messages", {
      signal: AbortSignal.timeout(5000),
    });
    const { messages } = await response.json();
    for (const item of messages.filter((m) =>
      m.To.some((to) => to.Address === address),
    )) {
      const message = await (
        await fetch(`${mail}/api/v1/message/${item.ID}`)
      ).json();
      const raw = new RegExp(`${key}=([A-Za-z0-9_-]{43})`).exec(
        message.Text,
      )?.[1];
      if (raw) return raw;
    }
    await delay(300);
  }
  assert.fail("Lien attendu absent de la boîte de test.");
}

test("Inscriptions : confirmation, approbation, capacité, activation et permissions", async (t) => {
  t.after(closeTestDb);
  await resetTestSchool();
  const stamp = randomUUID().slice(0, 8);
  const address = (role) => `registration-${role}-${stamp}@example.test`;
  await provision(address("owner"), password);
  const owner = (
    await db.query(
      "SELECT id,tenant_id,password_hash FROM users WHERE role='OWNER'",
    )
  ).rows[0];
  const { tenant_id: tenant } = owner;
  for (const role of ["SECRETARY", "TEACHER", "CASHIER"])
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) VALUES($1,$2,$3,$4,$5,$3,true)",
      [
        randomUUID(),
        tenant,
        role,
        address(role.toLowerCase()),
        owner.password_hash,
      ],
    );
  const login = async (who) =>
    (await call("auth/login", 201, { body: { email: address(who), password } }))
      .token;
  const admin = await login("owner"),
    secretary = await login("secretary"),
    teacher = await login("teacher"),
    cashier = await login("cashier");
  const course = randomUUID(),
    hidden = randomUUID();
  for (const id of [course, hidden])
    await db.query(
      "INSERT INTO groups(id,tenant_id,name,subject,level,capacity,fee_centimes) VALUES($1,$2,$3,'Mathématiques','3AS',1,200000)",
      [id, tenant, id === course ? "Maths A" : "Cours interne"],
    );
  const catalog = () => call("registrations/catalog", 200);
  assert.deepEqual((await catalog()).courses, []);
  await db.query(
    "UPDATE auth_sessions SET reauthenticated_at=now()-interval '11 minutes' WHERE token_hash=$1",
    [createHash("sha256").update(admin).digest("hex")],
  );
  await call("registrations/catalog/" + course, 428, {
    method: "PATCH",
    session: admin,
    body: { open: true },
  });
  await call("security/reauthenticate", 201, {
    session: admin,
    body: { current: password },
  });
  await call("security/reauthenticate", 201, {
    session: secretary,
    body: { current: password },
  });
  await call("registrations/catalog/" + course, 200, {
    method: "PATCH",
    session: admin,
    body: { open: true },
  });
  const listed = (await catalog()).courses;
  assert.deepEqual(
    listed.map((item) => item.id),
    [course],
  );
  assert.deepEqual(Object.keys(listed[0]).sort(), [
    "full",
    "id",
    "level",
    "name",
    "subject",
  ]);
  for (const session of [teacher, cashier])
    await call("registrations", 403, { session });
  await call("users", 403, { session: secretary });
  await call("students", 403, { session: secretary });
  await call("registrations/catalog/manage", 403, { session: secretary });
  await call("auth/invite", 403, {
    session: secretary,
    body: { role: "MANAGER" },
  });
  const pupil = {
    role: "STUDENT",
    student_kind: "new",
    first_name: "Lina",
    last_name: "Recette",
    email: address("student"),
    phone: "0550 00 00 00",
    level: "3AS",
    group_ids: [course],
    acknowledged: true,
    locale: "fr",
  };
  await call("registrations/request", 400, {
    body: { ...pupil, role: "MANAGER" },
  });
  await call("registrations/request", 400, {
    body: { ...pupil, tenant_id: tenant },
  });
  await call("registrations/request", 409, {
    body: { ...pupil, group_ids: [hidden] },
  });
  await call("registrations/request", 201, { body: pupil, native: true });
  await call("registrations/request", 201, { body: pupil });
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM registration_requests WHERE email=$1",
        [pupil.email],
      )
    ).rows[0].count,
    1,
  );
  assert.deepEqual(
    (await call("registrations", 200, { session: secretary })).requests,
    [],
  );
  assert.equal(
    (await db.query("SELECT 1 FROM users WHERE email=$1", [pupil.email]))
      .rowCount,
    0,
  );
  const confirmation = await mailToken(pupil.email, "confirm");
  await call("registrations/confirm", 201, { body: { token: confirmation } });
  await call("registrations/confirm", 400, { body: { token: confirmation } });

  const second = { ...pupil, first_name: "Amine", email: address("second") };
  await call("registrations/request", 201, { body: second });
  await call("registrations/confirm", 201, {
    body: { token: await mailToken(second.email, "confirm") },
  });
  const queue = (await call("registrations", 200, { session: secretary }))
    .requests;
  const first = queue.find((item) => item.email === pupil.email),
    other = queue.find((item) => item.email === second.email);
  const approve = (
    id,
    status,
    body = { identity_checked: true, group_ids: [course] },
    session = secretary,
  ) => call(`registrations/${id}/approve`, status, { session, body });
  await approve(first.id, 403, undefined, teacher);
  await approve(first.id, 400, {
    identity_checked: false,
    group_ids: [course],
  });
  await approve(first.id, 201);
  await approve(first.id, 201);
  await approve(other.id, 409);
  assert.equal(
    (
      await db.query("SELECT count(*) FROM enrollments WHERE group_id=$1", [
        course,
      ])
    ).rows[0].count,
    1,
  );
  assert.equal(
    (await db.query("SELECT 1 FROM users WHERE email=$1", [second.email]))
      .rowCount,
    0,
  );
  assert.equal((await catalog()).courses[0].full, true);
  const withoutCourse = {
    ...pupil,
    first_name: "Nour",
    email: address("without-course"),
    group_ids: [],
  };
  await call("registrations/request", 201, { body: withoutCourse });
  await call("registrations/confirm", 201, {
    body: { token: await mailToken(withoutCourse.email, "confirm") },
  });
  const unassigned = (
    await call("registrations", 200, { session: secretary })
  ).requests.find((item) => item.email === withoutCourse.email);
  assert.deepEqual(unassigned.courses, []);
  await approve(unassigned.id, 400);
  await approve(unassigned.id, 201, {
    identity_checked: true,
    group_ids: [],
  });
  const unassignedEnrollments = await db.query(
    "SELECT 1 FROM enrollments WHERE student_id=(SELECT student_id FROM registration_requests WHERE id=$1)",
    [unassigned.id],
  );
  assert.equal(unassignedEnrollments.rowCount, 0);
  const activation = await mailToken(pupil.email, "token");
  await call("auth/consume", 201, { body: { token: activation, password } });
  const studentSession = await login("student");
  const me = await call("auth/me", 200, { session: studentSession });
  assert.equal(me.role, "STUDENT");
  assert.equal(me.phone, "0550000000");
  const dossier = (
    await db.query("SELECT id FROM students WHERE user_id=$1", [me.id])
  ).rows[0];
  const parent = {
    role: "PARENT",
    student_kind: "existing",
    first_name: "Samira",
    last_name: "Recette",
    child_first_name: "Lina",
    child_last_name: "Recette",
    phone: "+213550000000",
    email: address("parent"),
    group_ids: [],
    acknowledged: true,
    locale: "ar",
  };
  await call("registrations/request", 201, { body: parent });
  await call("registrations/confirm", 201, {
    body: { token: await mailToken(parent.email, "confirm") },
  });
  const parentRequest = (
    await call("registrations", 200, { session: secretary })
  ).requests.find((item) => item.email === parent.email);
  await approve(parentRequest.id, 400, {
    identity_checked: true,
    group_ids: [],
  });
  await approve(parentRequest.id, 201, {
    identity_checked: true,
    student_id: dossier.id,
    group_ids: [],
  });
  assert.equal(
    (
      await db.query(
        "SELECT u.email FROM students s JOIN users u ON u.id=s.parent_id WHERE s.id=$1",
        [dossier.id],
      )
    ).rows[0].email,
    parent.email,
  );
  await call(`registrations/${other.id}/reject`, 201, {
    session: admin,
    body: { reason: "Ce groupe est complet." },
  });
  const history = (
    await call("registrations?history=true", 200, { session: secretary })
  ).requests;
  assert.equal(history.find((item) => item.id === other.id).status, "rejected");
});
