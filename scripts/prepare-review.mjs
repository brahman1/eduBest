import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { spawnSync } from "node:child_process";
import policy from "../shared/review-policy.cjs";
const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const file = resolve(process.argv[2] ?? ".local/review/api.env");
const privateDir = resolve(file, "..");
await mkdir(privateDir, { recursive: true, mode: 0o700 });
let config;
try {
  config = dotenv.parse(await readFile(file));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  config = {
    NODE_ENV: "development",
    PORT: "4250",
    WEB_URL: "http://127.0.0.1:3150",
    ALLOWED_ORIGINS: "http://127.0.0.1:3150",
    EDUBEST_DEMO_ENABLED: "false",
    EDUBEST_REVIEW_MODE: "true",
    EDUBEST_REVIEW_OUTBOUND: "disabled",
    EDUBEST_REVIEW_INSTANCE: randomBytes(32).toString("hex"),
    EDUBEST_REVIEW_PASSWORD: randomBytes(24).toString("base64url"),
    SECURITY_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    DATABASE_URL:
      "postgres://edubest_review:CONFIGURE_PRIVATE_PASSWORD@127.0.0.1:5448/edubest_review",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    BREVO_API_KEY: "",
    EXPO_ACCESS_TOKEN: "",
    SCHOOL_LEGAL_NAME: "KACI Belkacem",
    SCHOOL_ADDRESS: "M’Chedallah centre, Algérie",
    SCHOOL_CONTACT_EMAIL: "contact@edubest.dz",
    SCHOOL_PRIVACY_EMAIL: "contact@edubest.dz",
    DATA_HOSTING_DESCRIPTION:
      "Environnement de démonstration isolé : données exclusivement fictives.",
    DATA_RETENTION_POLICY:
      "Données fictives conservées pendant la revue, puis supprimées par l’exploitant.",
    DATA_PROCESSING_BASIS:
      "Démonstration du fonctionnement uniquement, sans dossier réel ni envoi externe.",
  };
  await writeFile(
    file,
    Object.entries(config)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Configuration privée créée. Configurer uniquement la nouvelle base de revue avant de relancer.",
  );
  process.exit(0);
}
Object.assign(process.env, config);
policy.validateReview();
const db = new Pool({ connectionString: config.DATABASE_URL });
try {
  const { assertReviewDatabase } = await import(
    pathToFileURL(resolve(root, "api/dist/review.js"))
  );
  await assertReviewDatabase(db);
  const marker = (
    await db.query(
      "SELECT to_regclass('public.review_initialization') AS marker",
    )
  ).rows[0].marker;
  if (marker) {
    await assertReviewDatabase(db, true);
    console.log(
      "Instance déjà initialisée : aucun compte, mot de passe ou dossier modifié.",
    );
    process.exitCode = 0;
  } else {
    const count = (
      await db.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows[0].n;
    if (count)
      throw Error(
        "Initialisation refusée : la base de revue doit être entièrement vide. Aucun effacement automatique.",
      );
    for (const script of [
      "api/dist/migrate.js",
      "scripts/demo.mjs",
      "scripts/demo-showcase.mjs",
    ]) {
      const result = spawnSync(process.execPath, [resolve(root, script)], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
      });
      if (result.status !== 0)
        throw Error(
          "Initialisation interrompue, vérifier la base dédiée. Aucun reset automatique.",
        );
    }
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "CREATE TABLE review_initialization(instance text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())",
      );
      await c.query("INSERT INTO review_initialization(instance) VALUES($1)", [
        config.EDUBEST_REVIEW_INSTANCE,
      ]);
      // Same fictional child identity in both the school record and the login account.
      await c.query(
        "UPDATE users u SET name=s.name FROM students s WHERE s.user_id=u.id",
      );
      // A parent sees multiple children and a student has their own individual access.
      await c.query(
        "UPDATE students SET parent_id=(SELECT id FROM users WHERE email='parent@edubest.test') WHERE id=(SELECT id FROM students WHERE user_id IS NULL AND active ORDER BY (level='2AS') DESC,created_at,id LIMIT 1)",
      );
      await c.query("COMMIT");
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
    const accounts = (
      await db.query(
        "SELECT role,email,name FROM users WHERE email=ANY($1::text[]) ORDER BY role",
        [
          [
            "direction@edubest.test",
            "professeur@edubest.test",
            "parent@edubest.test",
            "eleve@edubest.test",
          ],
        ],
      )
    ).rows;
    await writeFile(
      resolve(privateDir, "ACCES-REVUE-PRIVE.md"),
      `# EduBest — accès de démonstration privés\n\nDonnées fictives exclusivement. Ne pas utiliser dans l’école réelle.\n\nMot de passe : ${config.EDUBEST_REVIEW_PASSWORD}\n\n${accounts.map((a) => `- ${a.role} : ${a.email} — ${a.name}`).join("\n")}\n\nAndroid : choisir « Démonstration » sur la page de connexion (nouveau binaire requis).\nLes sorties email/push sont désactivées.\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Revue initialisée. Les quatre accès sont conservés dans ACCES-REVUE-PRIVE.md, hors du code.",
    );
  }
} finally {
  await db.end();
}
