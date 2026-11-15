import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { db, transaction } from "../api/dist/db.js";
import { provision, resetTestSchool, closeTestDb } from "./support/school.mjs";
import { notify, invoiceNotice, mailFailure } from "../api/dist/delivery.js";
import { workbook } from "../api/dist/xlsx.js";
import { canView, pageLabel } from "../shared/dist/index.js";
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
  const data = await r.json();
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
test("Recette école : identités, droits, courriers, rémunérations, statistiques et exports", async (t) => {
  await resetTestSchool();
  t.after(closeTestDb);
  const owner = await provision("workflow-owner@example.test", password);
  const login = async (email) =>
    (await call("auth/login", null, "POST", { email, password }, 201)).token;
  const admin = await login("workflow-owner@example.test");
  const users = {};
  for (const role of ["PARENT", "STUDENT", "TEACHER", "CASHIER"]) {
    const id = randomUUID(),
      email = `workflow-${role.toLowerCase()}@example.test`;
    await db.query(
      "INSERT INTO users(id,tenant_id,name,email,role,verified,password_hash) SELECT $1,tenant_id,$2,$3,$4,true,password_hash FROM users WHERE id=$5",
      [id, `Identité ${role}`, email, role, owner.userId],
    );
    users[role] = { id, email, token: await login(email) };
  }
  let linked, other, group, lesson;
  await t.test(
    "Migration des anciens comptes : noms unifiés, MFA administrateur préservée",
    async () => {
      assert.equal(
        (await db.query("SELECT current_database() AS name")).rows[0].name,
        "edubest_test",
      );
      assert.equal(process.env.EDUBEST_TEST_DATABASE, "true");
      const c = await db.connect();
      try {
        await c.query(
          "BEGIN; CREATE SCHEMA review_legacy; SET LOCAL search_path=review_legacy",
        );
        const migrations = new URL("../api/migrations/", import.meta.url);
        for (const file of (await readdir(migrations))
          .filter((f) => f.endsWith(".sql") && !f.startsWith("008"))
          .sort())
          await c.query(await readFile(new URL(file, migrations), "utf8"));
        const tenant = randomUUID(),
          ownerId = randomUUID(),
          studentId = randomUUID();
        await c.query(
          "INSERT INTO tenants(id,name,slug) VALUES($1,'École de recette','edubest')",
          [tenant],
        );
        for (const [id, role, name] of [
          [ownerId, "OWNER", "Admin de recette"],
          [studentId, "STUDENT", "Identité du compte"],
        ])
          await c.query(
            "INSERT INTO users(id,tenant_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
            [id, tenant, name, `${id}@example.test`, "fixture", role],
          );
        await c.query(
          "INSERT INTO students(id,tenant_id,name,user_id) VALUES($1,$2,'Ancien nom divergent',$3)",
          [randomUUID(), tenant, studentId],
        );
        for (const id of [ownerId, studentId])
          await c.query(
            "INSERT INTO user_mfa(user_id,secret_encrypted,enabled) VALUES($1,'fixture',true)",
            [id],
          );
        await c.query(
          await readFile(
            new URL("008-delivery-and-role-policy.sql", migrations),
            "utf8",
          ),
        );
        assert.equal(
          (
            await c.query("SELECT name FROM students WHERE user_id=$1", [
              studentId,
            ])
          ).rows[0].name,
          "Identité du compte",
        );
        assert.equal(
          (await c.query("SELECT user_id FROM user_mfa")).rows[0].user_id,
          ownerId,
        );
        assert.equal(
          (await c.query("SELECT count(*)::int AS n FROM user_mfa")).rows[0].n,
          1,
        );
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    },
  );
  await t.test(
    "Un compte élève, un dossier canonique ; le nom reste synchronisé",
    async () => {
      linked = (
        await call("students", admin, "POST", {
          name: "Nom divergent à ignorer",
          parent_id: users.PARENT.id,
          user_id: users.STUDENT.id,
        })
      ).id;
      assert.equal(
        (await call("students", admin)).find((s) => s.id === linked).name,
        "Identité STUDENT",
      );
      await call(
        "students",
        admin,
        "POST",
        { name: "Doublon", user_id: users.STUDENT.id },
        409,
      );
      await call(`students/${linked}`, admin, "PATCH", {
        name: "Identité corrigée",
        parent_id: users.PARENT.id,
        user_id: users.STUDENT.id,
      });
      assert.equal(
        (await call("auth/me", users.STUDENT.token)).name,
        "Identité corrigée",
      );
      await assert.rejects(
        db.query(
          "INSERT INTO students(id,tenant_id,name,user_id) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            owner.tenantId ??
              (
                await db.query("SELECT tenant_id FROM users WHERE id=$1", [
                  owner.userId,
                ])
              ).rows[0].tenant_id,
            "Doublon SQL",
            users.STUDENT.id,
          ],
        ),
        /déjà associé/,
      );
      other = (
        await call("students", admin, "POST", {
          name: "Autre dossier indépendant",
        })
      ).id;
    },
  );
  await t.test(
    "Ancien lien ambigu : refus des données élève, profil disponible et alerte administrateur",
    async () => {
      assert.equal(
        (await db.query("SELECT current_database() AS name")).rows[0].name,
        "edubest_test",
      );
      const duplicate = randomUUID();
      try {
        await transaction(async (c) => {
          await c.query(
            "ALTER TABLE students DISABLE TRIGGER student_login_link",
          );
          await c.query(
            "INSERT INTO students(id,tenant_id,name,user_id) SELECT $1,tenant_id,'Ancien doublon de recette',id FROM users WHERE id=$2",
            [duplicate, users.STUDENT.id],
          );
          await c.query(
            "ALTER TABLE students ENABLE TRIGGER student_login_link",
          );
        });
        await call("students", users.STUDENT.token, "GET", undefined, 403);
        assert.equal(
          (await call("profile", users.STUDENT.token)).role,
          "STUDENT",
        );
        assert.equal(
          (await call("users", admin)).find((u) => u.id === users.STUDENT.id)
            .student_records,
          2,
        );
      } finally {
        await db.query("DELETE FROM students WHERE id=$1", [duplicate]);
      }
    },
  );
  await t.test(
    "Une invitation élève crée son dossier ; rattacher un dossier ne le duplique pas",
    async () => {
      const invited = await call(
        "auth/invite",
        admin,
        "POST",
        {
          name: "Élève invité",
          email: "invited-workflow@example.test",
          role: "STUDENT",
        },
        201,
      );
      const rows = await db.query(
        "SELECT s.name,s.user_id,u.name AS account FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1",
        [invited.student_id],
      );
      assert.equal(rows.rowCount, 1);
      assert.equal(rows.rows[0].name, rows.rows[0].account);
      const attached = await call(
        "auth/invite",
        admin,
        "POST",
        {
          name: "Dossier et compte unifiés",
          email: "attached-workflow@example.test",
          role: "STUDENT",
          student_id: other,
        },
        201,
      );
      assert.equal(attached.student_id, other);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM students WHERE user_id=$1",
            [attached.id],
          )
        ).rows[0].n,
        1,
      );
      await call(
        "auth/invite",
        admin,
        "POST",
        {
          name: "Encore un compte",
          email: "duplicate-workflow@example.test",
          role: "STUDENT",
          student_id: other,
        },
        400,
      );
      await call("auth/invite/resend", admin, "POST", { id: invited.id }, 201);
      const jobs = (
        await db.query(
          "SELECT topic,tenant_id,user_id FROM outbox WHERE user_id=$1 AND topic='account'",
          [invited.id],
        )
      ).rows;
      assert.ok(jobs.length >= 2);
      assert.ok(jobs.every((j) => j.tenant_id && j.user_id));
    },
  );
  await t.test(
    "2FA exclue pour élève, parent, enseignant et caissier, y compris ancien enrôlement",
    async () => {
      for (const role of ["STUDENT", "PARENT", "TEACHER", "CASHIER"]) {
        await db.query(
          "INSERT INTO user_mfa(user_id,secret_encrypted,enabled) VALUES($1,'ancien-secret-inutilisable',true)",
          [users[role].id],
        );
        assert.ok(await login(users[role].email));
        const security = await call("security/account", users[role].token);
        assert.equal(security.mfa_required, false);
        assert.equal(security.mfa_enabled, false);
        assert.equal(security.mfa_allowed, false);
        await call(
          "security/mfa/setup",
          users[role].token,
          "POST",
          { current: password },
          403,
        );
      }
    },
  );
  await t.test(
    "Rôles : aucun accès administratif et seulement ses dossiers/données",
    async () => {
      const pupil = users.STUDENT.token;
      assert.equal((await call("students", pupil)).length, 1);
      const home = await call("dashboard", pupil);
      assert.equal(home.students, 1);
      assert.equal(home.collected_centimes, 0);
      assert.equal((await call("profile", pupil)).role, "STUDENT");
      for (const path of [
        "users",
        "settings",
        "audit",
        "delivery",
        "reports/export?format=json",
      ])
        await call(path, pupil, "GET", undefined, 403);
      await call("students", pupil, "POST", { name: "Non autorisé" }, 403);
      assert.equal(canView("STUDENT", "users"), false);
      assert.equal(canView("PARENT", "exports"), false);
      assert.equal(canView("TEACHER", "delivery"), false);
      assert.equal(canView("CASHIER", "exports"), false);
      assert.equal(pageLabel("students", "STUDENT", "fr"), "Mon dossier");
      assert.equal(canView("OWNER", "exports"), true);
    },
  );
  await t.test(
    "Échéance : email au parent vérifié, notifications parent et élève ; repli élève",
    async () => {
      const invoice = (
        await call("invoices", admin, "POST", {
          student_id: linked,
          label: "Mensualité de recette",
          amount_centimes: 250000,
          due_date: "2026-10-31",
        })
      ).id;
      const jobs = (
        await db.query(
          "SELECT user_id,channel FROM outbox WHERE topic='invoice' AND resource_id=$1",
          [invoice],
        )
      ).rows;
      assert.equal(
        jobs.filter(
          (j) => j.channel === "email" && j.user_id === users.PARENT.id,
        ).length,
        1,
      );
      assert.equal(
        jobs.filter(
          (j) => j.channel === "email" && j.user_id === users.STUDENT.id,
        ).length,
        0,
      );
      for (const role of ["PARENT", "STUDENT"])
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1",
              [users[role].id],
            )
          ).rows[0].n,
          1,
        );
      await db.query("UPDATE users SET verified=false WHERE id=$1", [
        users.PARENT.id,
      ]);
      const result = await call(`invoices/${invoice}/send`, admin, "POST", {});
      assert.equal(result.emails, 1);
      assert.equal(result.notifications, 2);
      assert.ok(
        (
          await db.query(
            "SELECT 1 FROM outbox WHERE topic='invoice' AND resource_id=$1 AND user_id=$2 AND channel='email'",
            [invoice, users.STUDENT.id],
          )
        ).rowCount,
      );
      await db.query("UPDATE users SET verified=true WHERE id=$1", [
        users.PARENT.id,
      ]);
    },
  );
  await t.test(
    "Appels et rémunération : séance terminée, taux, paiement et remboursement",
    async () => {
      group = (
        await call("groups", admin, "POST", {
          name: "Groupe de recette",
          subject: "Mathématiques",
          teacher_id: users.TEACHER.id,
          capacity: 12,
          fee_centimes: 250000,
          pay_mode: "hour",
          pay_value: 120000,
        })
      ).id;
      await call(`groups/${group}/enroll`, admin, "POST", {
        student_id: linked,
      });
      lesson = (
        await call("sessions", admin, "POST", {
          group_id: group,
          starts_at: "2026-10-05T09:00:00+01:00",
          ends_at: "2026-10-05T10:30:00+01:00",
        })
      ).id;
      const before = await call("payroll?month=2026-10", admin);
      assert.equal(
        before.find((t) => t.id === users.TEACHER.id).earned_centimes,
        0,
      );
      await call(`sessions/${lesson}/attendance`, users.TEACHER.token, "PUT", {
        entries: [{ student_id: linked, status: "late" }],
      });
      await call(`sessions/${lesson}/status`, users.TEACHER.token, "POST", {
        status: "completed",
      });
      const salary = (await call("payroll?month=2026-10", admin)).find(
        (t) => t.id === users.TEACHER.id,
      );
      assert.equal(salary.earned_centimes, 180000);
      assert.equal(salary.groups[0].earned_centimes, 180000);
      const stats = await call(
        "attendance-stats?from=2026-10-01&to=2026-10-31",
        users.STUDENT.token,
      );
      assert.equal(stats.students.length, 1);
      assert.equal(stats.students[0].presence_rate, 100);
      assert.equal(stats.students[0].absence_rate, 0);
      assert.equal(stats.students[0].late, 1);
      assert.equal(stats.teachers[0].name, "Identité TEACHER");
      await call(`sessions/${lesson}/attendance`, admin, "PUT", {
        entries: [{ student_id: linked, status: "absent" }],
      });
      assert.equal(
        (
          await call(
            "attendance-stats?from=2026-10-01&to=2026-10-31",
            users.STUDENT.token,
          )
        ).students[0].absence_rate,
        100,
      );
      assert.equal(
        (await call("payroll?month=2026-10", users.TEACHER.token)).length,
        1,
      );
      await call("payroll", admin, "POST", {
        teacher_id: users.TEACHER.id,
        month: "2026-10",
        amount_centimes: 180000,
        reference: "REGLEMENT-RECETTE",
      });
      assert.equal(
        (await call("payroll?month=2026-10", admin)).find(
          (t) => t.id === users.TEACHER.id,
        ).balance_centimes,
        0,
      );
      const percent = (
        await call("groups", admin, "POST", {
          name: "Pourcentage recette",
          subject: "Langues",
          teacher_id: users.TEACHER.id,
          capacity: 12,
          fee_centimes: 100000,
          pay_mode: "percent",
          pay_value: 3000,
        })
      ).id;
      const inv = (
        await call("invoices", admin, "POST", {
          student_id: linked,
          group_id: percent,
          label: "Pourcentage",
          amount_centimes: 100000,
          due_date: "2026-10-31",
        })
      ).id;
      const pay = await fetch(base + "/payments", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Authorization: `Bearer ${admin}`,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          invoice_id: inv,
          amount_centimes: 100000,
          method: "cash",
        }),
      });
      assert.equal(pay.status, 200);
      const payment = await pay.json();
      const month = new Date()
        .toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" })
        .slice(0, 7);
      const earnedBefore = (await call(`payroll?month=${month}`, admin)).find(
        (t) => t.id === users.TEACHER.id,
      ).earned_centimes;
      const refund = await fetch(base + "/refunds", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Authorization: `Bearer ${admin}`,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          payment_id: payment.id,
          amount_centimes: 20000,
          reference: "REMBOURSEMENT-RECETTE",
        }),
      });
      assert.equal(refund.status, 200);
      assert.equal(
        (await call(`payroll?month=${month}`, admin)).find(
          (t) => t.id === users.TEACHER.id,
        ).earned_centimes,
        earnedBefore - 6000,
      );
    },
  );
  await t.test(
    "Annonce ciblée : email et notifications aux destinataires concernés seulement",
    async () => {
      const notice = await call("announcements", admin, "POST", {
        group_id: group,
        title: "Annonce ciblée de recette",
        body: "Contenu de recette réservé aux inscrits.",
      });
      for (const role of ["PARENT", "STUDENT", "TEACHER"]) {
        const count = (
          await db.query(
            "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Annonce ciblée de recette'",
            [users[role].id],
          )
        ).rows[0].n;
        assert.equal(count, 1);
        const jobs = await db.query(
          "SELECT 1 FROM outbox WHERE user_id=$1 AND topic='announcements' AND channel='email'",
          [users[role].id],
        );
        assert.ok(jobs.rowCount);
      }
      assert.equal(
        (await call("announcements", users.CASHIER.token)).some(
          (n) => n.id === notice.id,
        ),
        true,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Annonce ciblée de recette'",
            [users.CASHIER.id],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await t.test(
    "Exports administrateur, périodes bornées et vrai classeur Excel sans formules",
    async () => {
      const data = await call(
        "reports/export?format=json&dataset=all&from=2026-10-01&to=2026-10-31",
        admin,
      );
      assert.ok(data.sheets.find((s) => s.name === "Eleves"));
      assert.ok(data.sheets.find((s) => s.name === "Parents"));
      assert.ok(data.sheets.find((s) => s.name === "Enseignants"));
      assert.ok(data.sheets.find((s) => s.name === "Bilan"));
      assert.ok(data.sheets.find((s) => s.name === "Remunerations par mois"));
      assert.ok(!JSON.stringify(data).includes("password_hash"));
      await call(
        "reports/export?format=json&from=2026-10-31&to=2026-10-01",
        admin,
        "GET",
        undefined,
        400,
      );
      const r = await fetch(
        base +
          "/reports/export?format=xlsx&dataset=students&from=2026-10-01&to=2026-10-31",
        { headers: { Authorization: `Bearer ${admin}` } },
      );
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type"), /spreadsheetml/);
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.equal(bytes.readUInt32LE(0), 0x04034b50);
      const fixture = workbook([
        {
          name: "Élèves",
          rows: [
            { nom: '=HYPERLINK("evil")', arabe: "تلميذ", montant_DA: 1500.5 },
          ],
        },
      ]);
      assert.ok(fixture.includes(Buffer.from("inlineStr")));
      assert.ok(!fixture.includes(Buffer.from("<f>")));
      assert.ok(fixture.includes(Buffer.from("تلميذ")));
      const fs = await import("node:fs/promises");
      await fs
        .writeFile("/result/workflow-export.xlsx", fixture)
        .catch(() => {});
    },
  );
  await t.test(
    "Échecs Microsoft diagnostiqués sans divulguer adresse ou lien privé",
    async () => {
      const f = mailFailure({
        responseCode: 550,
        response:
          "550 5.7.1 Microsoft blocked secret@example.test https://private?token=SECRET",
      });
      assert.equal(f.permanent, true);
      assert.match(f.reason, /SPF.*DKIM.*DMARC/);
      assert.ok(!f.reason.includes("SECRET"));
      assert.ok(!f.reason.includes("@"));
      const delivery = await call("delivery", admin);
      assert.ok(delivery.jobs.length);
      assert.ok(!JSON.stringify(delivery).includes("payload"));
      assert.ok(!JSON.stringify(delivery).includes("token="));
    },
  );
});
