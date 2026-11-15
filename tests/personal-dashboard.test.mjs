import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../api/dist/db.js";
import { provision, resetTestSchool, closeTestDb } from "./support/school.mjs";
import { personalHome } from "../shared/dist/personal-home.js";
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4206/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3120";
const password = "Une phrase de recette locale EduBest 2026!";
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
  const v = await r.json();
  assert.equal(r.status, status, JSON.stringify(v));
  return v;
}
test("Dashboards personnalisés : cloisonnement réel et actions par rôle", async (t) => {
  await resetTestSchool();
  t.after(closeTestDb);
  const owner = await provision("home-owner@example.test", password);
  const users = {};
  for (const [key, role] of [
    ["parent", "PARENT"],
    ["student", "STUDENT"],
    ["student2", "STUDENT"],
    ["outsider", "STUDENT"],
    ["teacher", "TEACHER"],
    ["teacher2", "TEACHER"],
  ]) {
    const id = randomUUID(),
      email = `home-${key}@example.test`;
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,role,verified,password_hash) SELECT $1,tenant_id,$2,$3,$4,true,password_hash FROM users WHERE id=$5",
      [id, key, email, role, owner.userId],
    );
    users[key] = {
      id,
      token: (await call("auth/login", null, "POST", { email, password }, 201))
        .token,
    };
  }
  const students = {},
    groups = {},
    lessons = {};
  for (const [key, parent] of [
    ["student", users.parent.id],
    ["student2", users.parent.id],
    ["outsider", null],
  ]) {
    const id = randomUUID();
    students[key] = id;
    await db.query(
      "INSERT INTO students(id,tenant_id,name,parent_id,user_id) VALUES($1,$2,$3,$4,$5)",
      [id, owner.schoolId, key, parent, users[key].id],
    );
    const gid = randomUUID();
    groups[key] = gid;
    await db.query(
      "INSERT INTO groups(id,tenant_id,name,subject,teacher_id,capacity,fee_centimes) VALUES($1,$2,$3,'Mathématiques',$4,20,100000)",
      [
        gid,
        owner.schoolId,
        key,
        key === "outsider" ? users.teacher2.id : users.teacher.id,
      ],
    );
    await db.query(
      "INSERT INTO enrollments(tenant_id,group_id,student_id) VALUES($1,$2,$3)",
      [owner.schoolId, gid, id],
    );
    const lid = randomUUID();
    lessons[key] = lid;
    await db.query(
      "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,teacher_id) VALUES($1,$2,$3,now()+interval '1 day',now()+interval '1 day 1 hour',$4)",
      [
        lid,
        owner.schoolId,
        gid,
        key === "outsider" ? users.teacher2.id : users.teacher.id,
      ],
    );
    await db.query(
      "INSERT INTO announcements(id,tenant_id,group_id,title,body,created_by) VALUES($1,$2,$3,$4,'Détails du cours',$5)",
      [randomUUID(), owner.schoolId, gid, key, owner.userId],
    );
    await db.query(
      "INSERT INTO invoices(id,tenant_id,student_id,label,amount_centimes,due_date) VALUES($1,$2,$3,'Échéance',100000,current_date)",
      [randomUUID(), owner.schoolId, id],
    );
  }
  const cancelled = randomUUID(),
    past = randomUUID();
  await db.query(
    "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,status,teacher_id) VALUES($1,$2,$3,now()+interval '2 days',now()+interval '2 days 1 hour','cancelled',$4),($5,$2,$3,now()-interval '2 hours',now()-interval '1 hour','scheduled',$4)",
    [cancelled, owner.schoolId, groups.student, users.teacher.id, past],
  );
  await db.query(
    "INSERT INTO notifications(id,tenant_id,user_id,title,body) VALUES($1,$2,$3,'Alerte parent','Message familial'),($4,$2,$5,'Secret autre compte','Privé')",
    [
      randomUUID(),
      owner.schoolId,
      users.parent.id,
      randomUUID(),
      users.outsider.id,
    ],
  );
  const parent = await call("dashboard", users.parent.token);
  await t.test(
    "Parent : deux enfants, affectation explicite des cours, aucune autre famille",
    () => {
      assert.deepEqual(
        parent.personal.children.map((c) => c.id).sort(),
        [students.student, students.student2].sort(),
      );
      assert.equal(
        parent.personal.agenda.some((l) => l.id === lessons.outsider),
        false,
      );
      assert.equal(
        parent.personal.announcements.some((a) => a.title === "outsider"),
        false,
      );
      assert.equal(parent.personal.notices.length, 1);
      assert.equal(parent.outstanding_personal.length, 2);
      const h = personalHome(parent, students.student2);
      assert.equal(h.next.id, lessons.student2);
      assert.equal(h.outstanding.length, 1);
      assert.deepEqual(
        h.next.children.map((c) => c.id),
        [students.student2],
      );
    },
  );
  const pupil = await call("dashboard", users.student.token);
  await t.test(
    "Élève : seul son dossier, ses cours, ses frais et annonces",
    () => {
      assert.deepEqual(
        pupil.personal.children.map((c) => c.id),
        [students.student],
      );
      assert.equal(
        pupil.personal.agenda.some((l) => l.id === lessons.student2),
        false,
      );
      assert.equal(pupil.personal.notices.length, 0);
      assert.equal(pupil.outstanding_personal.length, 1);
      assert.equal(
        pupil.personal.agenda.some((l) => l.id === cancelled),
        true,
      );
    },
  );
  const teacher = await call("dashboard", users.teacher.token);
  await t.test(
    "Enseignant : ses groupes et appels, aucun paiement familial ni autres cours",
    () => {
      assert.deepEqual(teacher.personal.children, []);
      assert.equal(
        teacher.personal.agenda.some((l) => l.id === lessons.outsider),
        false,
      );
      assert.deepEqual(teacher.outstanding_personal, []);
      assert.equal(teacher.personal.notices.length, 0);
      assert.equal(
        teacher.personal.agenda.find((l) => l.id === past).call.expected,
        1,
      );
      assert.equal(
        personalHome(teacher).pending.some((l) => l.id === past),
        true,
      );
    },
  );
  await t.test(
    "Lecture effective : une notification lue quitte les alertes",
    async () => {
      await call("notifications/read", users.parent.token, "POST", {
        id: parent.personal.notices[0].id,
      });
      assert.equal(
        (await call("dashboard", users.parent.token)).personal.notices.length,
        0,
      );
    },
  );
  await t.test(
    "API : un élève ne peut pas ouvrir le cours d’un autre ni modifier l’appel",
    async () => {
      await call(
        `sessions/${lessons.outsider}/attendance`,
        users.student.token,
        "GET",
        undefined,
        404,
      );
      await call(
        `sessions/${lessons.student}/attendance`,
        users.student.token,
        "PUT",
        { entries: [{ student_id: students.student, status: "present" }] },
        403,
      );
    },
  );
});
