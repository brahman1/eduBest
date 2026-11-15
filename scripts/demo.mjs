import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { demoConfig } from "./demo-config.mjs";
const { connection, password, cloud } = demoConfig();
const db = new Pool({ connectionString: connection });
const slug = "edubest";
const access = `# Accès locaux — données fictives uniquement\n\nSite : http://127.0.0.1:3100\n\nMot de passe des comptes de test : ${password}\n\n| Rôle | Email |\n|---|---|\n| Direction | direction@edubest.test |\n| Enseignant | professeur@edubest.test |\n| Parent | parent@edubest.test |\n| Caissier | caisse@edubest.test |\n| Élève | eleve@edubest.test |\n| Responsable | responsable@edubest.test |\n\nCes comptes sont créés uniquement par la commande locale npm run demo. Aucune donnée réelle. Ne pas utiliser en production.\n`;
const c = await db.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(812349)");
  await c.query(
    "CREATE TABLE IF NOT EXISTS demo_initialization(version text PRIMARY KEY, initialized_at timestamptz NOT NULL DEFAULT now())",
  );
  const exists = (await c.query("SELECT 1 FROM tenants LIMIT 1")).rowCount;
  const isDemo = (
    await c.query(
      "SELECT 1 FROM demo_initialization WHERE version='edubest-demo-v1'",
    )
  ).rowCount;
  if (exists && !isDemo)
    throw new Error(
      "Ajout de données fictives refusé dans une école déjà initialisée hors démonstration.",
    );
  if (
    !(await c.query("SELECT id FROM tenants WHERE slug=$1", [slug])).rowCount
  ) {
    const tid = randomUUID(),
      users = {},
      encrypted = await hash(password, 12);
    await c.query(
      "INSERT INTO tenants(id,name,slug,address,phone) VALUES($1,$2,$3,$4,$5)",
      [
        tid,
        "EduBest — école de démonstration",
        slug,
        "Alger — adresse fictive",
        "",
      ],
    );
    for (const [role, email, name] of [
      ["OWNER", "direction@edubest.test", "Direction EduBest"],
      ["TEACHER", "professeur@edubest.test", "Nadia — enseignante fictive"],
      ["PARENT", "parent@edubest.test", "Parent de démonstration"],
      ["CASHIER", "caisse@edubest.test", "Caisse de démonstration"],
      ["STUDENT", "eleve@edubest.test", "Élève de démonstration"],
      ["MANAGER", "responsable@edubest.test", "Responsable de démonstration"],
    ]) {
      users[role] = randomUUID();
      await c.query(
        "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) VALUES($1,$2,$3,$4,$5,$6,true)",
        [users[role], tid, name, email, encrypted, role],
      );
    }
    const gids = [randomUUID(), randomUUID()],
      sids = [];
    for (let i = 0; i < 4; i++) {
      const sid = randomUUID();
      sids.push(sid);
      await c.query(
        "INSERT INTO students(id,tenant_id,name,level,parent_id,user_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          sid,
          tid,
          [
            "Lina — élève fictive",
            "Amine — élève fictif",
            "Yasmine — élève fictive",
            "Karim — élève fictif",
          ][i],
          i < 2 ? "3AS" : "2AS",
          i === 0 ? users.PARENT : null,
          i === 0 ? users.STUDENT : null,
        ],
      );
    }
    for (let i = 0; i < 2; i++) {
      await c.query(
        "INSERT INTO groups(id,tenant_id,name,subject,level,teacher_id,room,capacity,fee_centimes,pay_mode,pay_value) VALUES($1,$2,$3,$4,$5,$6,$7,20,$8,$9,$10)",
        [
          gids[i],
          tid,
          ["Mathématiques · Terminale", "Physique · 2AS"][i],
          ["Mathématiques", "Physique"][i],
          i === 0 ? "3AS" : "2AS",
          users.TEACHER,
          `Salle ${i + 1}`,
          i === 0 ? 600000 : 500000,
          "hour",
          150000,
        ],
      );
      for (const sid of sids.slice(i * 2, i * 2 + 2))
        await c.query(
          "INSERT INTO enrollments(tenant_id,group_id,student_id) VALUES($1,$2,$3)",
          [tid, gids[i], sid],
        );
    }
    const now = new Date(),
      tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
      yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    for (let i = 0; i < 2; i++)
      await c.query(
        "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,room) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          tid,
          gids[i],
          `${tomorrow}T${i === 0 ? "09" : "11"}:00:00+01:00`,
          `${tomorrow}T${i === 0 ? "10" : "12"}:30:00+01:00`,
          `Salle ${i + 1}`,
        ],
      );
    const lid = randomUUID();
    await c.query(
      "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,room,status) VALUES($1,$2,$3,$4,$5,'Salle 1','completed')",
      [
        lid,
        tid,
        gids[0],
        `${yesterday}T09:00:00+01:00`,
        `${yesterday}T10:30:00+01:00`,
      ],
    );
    await c.query(
      "INSERT INTO attendance(tenant_id,lesson_id,student_id,status,updated_by) VALUES($1,$2,$3,'absent',$4)",
      [tid, lid, sids[0], users.TEACHER],
    );
    for (let i = 0; i < 4; i++) {
      const iid = randomUUID();
      await c.query(
        "INSERT INTO invoices(id,tenant_id,student_id,group_id,label,amount_centimes,due_date) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          iid,
          tid,
          sids[i],
          gids[i < 2 ? 0 : 1],
          "Mensualité de démonstration",
          i < 2 ? 600000 : 500000,
          now.toISOString().slice(0, 10),
        ],
      );
      if (i < 2)
        await c.query(
          "INSERT INTO payments(id,tenant_id,invoice_id,amount_centimes,kind,method,created_by,idempotency_key,fingerprint) VALUES($1,$2,$3,$4,'payment','cash',$5,$6,'demo')",
          [
            randomUUID(),
            tid,
            iid,
            i === 0 ? 300000 : 600000,
            users.CASHIER,
            randomUUID(),
          ],
        );
    }
    await c.query(
      "INSERT INTO announcements(id,tenant_id,title,body,created_by) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        tid,
        "Bienvenue dans votre espace EduBest",
        "Cet établissement contient exclusivement des données fictives pour tester les parcours. Connectez-vous avec les différents rôles pour découvrir EduBest.",
        users.OWNER,
      ],
    );
    await c.query(
      "INSERT INTO notifications(id,tenant_id,user_id,title,body) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        tid,
        users.PARENT,
        "Absence de démonstration",
        "Un exemple de suivi d’absence. Consultez le planning pour envoyer un justificatif.",
      ],
    );
    await c.query(
      "INSERT INTO materials(id,tenant_id,group_id,title,filename,mime,content,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        tid,
        gids[0],
        "Conseils de révision — exemple",
        "revision.txt",
        "text/plain",
        Buffer.from(
          "EduBest — document fictif de démonstration.\nRelire le cours, refaire les exercices et préparer ses questions.",
        ),
        users.TEACHER,
      ],
    );
  }
  await c.query(
    "UPDATE lessons l SET teacher_id=g.teacher_id,pay_mode=g.pay_mode,pay_value=g.pay_value FROM groups g JOIN tenants t ON t.id=g.tenant_id WHERE t.slug='edubest' AND g.id=l.group_id AND g.tenant_id=l.tenant_id AND l.teacher_id IS NULL",
  );
  await c.query(
    "INSERT INTO demo_initialization(version) VALUES('edubest-demo-v1') ON CONFLICT DO NOTHING",
  );
  await c.query("COMMIT");
  if (!cloud) await writeFile("ACCES-LOCAL.md", access, "utf8");
  console.log(
    cloud
      ? "Établissement de test prêt (données fictives)."
      : "Établissement local prêt. Identifiants dans ACCES-LOCAL.md.",
  );
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await db.end();
}
