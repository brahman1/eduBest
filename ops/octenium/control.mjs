import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const apiRequire = createRequire(
  new URL("../../api/dist/main.js", import.meta.url),
);
const {
  privateLocation,
  loadPrivateEnvironment,
  requireRuntime,
} = require("./private-env.cjs");
const policy = require("../../shared/database-policy.cjs");
const profile = require("./public.json");
const [action, ...args] = process.argv.slice(2);
const flag = args.indexOf("--env-file");
const envFile = flag >= 0 ? args[flag + 1] : process.env.EDUBEST_ENV_FILE;

export async function prepare(file) {
  file = privateLocation(file);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const values = require("dotenv").parse(
    await readFile(new URL("api.env.example", import.meta.url)),
  );
  const keyFile = join(dirname(file), "backup.key");
  values.SECURITY_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  values.EDUBEST_BACKUP_KEY_FILE = keyFile;
  // Exclusive writes: existing configuration or keys are never replaced.
  let createdKey = false;
  try {
    await writeFile(keyFile, randomBytes(32).toString("hex") + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    createdKey = true;
    await writeFile(
      file,
      Object.entries(values)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join("\n") + "\n",
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if (createdKey) await rm(keyFile, { force: true });
    throw error;
  }
  return file;
}

async function configuration() {
  requireRuntime();
  const loaded = loadPrivateEnvironment(envFile);
  const { validateProduction } = require("../../api/dist/production.js");
  validateProduction();
  if (!policy.account(process.env))
    throw Error("EDUBEST_CPANEL_ACCOUNT requis : nom exact du compte cPanel.");
  if (process.env.WEB_URL !== profile.web_url)
    throw Error("Le domaine du profil ne correspond pas à WEB_URL.");
  return loaded;
}
async function inspectDatabase(db) {
  const client = await db.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const info = (
      await client.query(
        "SELECT current_database() AS name,current_setting('server_version_num')::int AS version,to_regclass('public.tenants') AS school_table,to_regclass('public.demo_initialization') AS demo",
      )
    ).rows[0];
    if (
      info.name !==
        decodeURIComponent(
          new URL(process.env.DATABASE_URL).pathname.slice(1),
        ) ||
      !policy.productionDatabaseName(info.name)
    )
      throw Error("Base PostgreSQL inattendue.");
    if (info.version < 160015)
      throw Error("PostgreSQL 16.15 minimum requis pour le livrable validé.");
    if (info.demo) throw Error("Base de démonstration refusée.");
    if (info.school_table) {
      const { assertNoDemoData } = require("../../api/dist/production.js");
      await assertNoDemoData(client);
      const schools = (await client.query("SELECT slug FROM tenants")).rows;
      if (schools.length > 1 || schools.some((s) => s.slug !== "edubest"))
        throw Error("Établissement inattendu.");
    }
    return {
      postgresql_version: Math.floor(info.version / 10000),
      schema_present: !!info.school_table,
    };
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
export async function publicSmoke() {
  const result = {};
  for (const path of [
    "/",
    "/auth",
    "/legal",
    "/account-deletion",
    "/api/public/health",
    "/api/public/notice",
    "/api/students",
    "/api/users",
  ]) {
    const response = await fetch(profile.web_url + path, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const expected = ["/api/students", "/api/users"].includes(path) ? 401 : 200;
    if (
      response.status !== expected ||
      !/no-store/.test(response.headers.get("cache-control") || "")
    )
      throw Error("Recette publique refusée pour " + path);
    if (path === "/api/public/notice") {
      const data = await response.json();
      if (
        data.demo !== false ||
        data.legal_name !== profile.legal_name ||
        data.privacy_email !== profile.privacy_email ||
        data.country !== "DZ" ||
        data.currency !== "DZD"
      )
        throw Error("Notice ou mode de production non conformes au profil.");
    }
    result[path] = response.status;
  }
  const apiHealth = await fetch(profile.api_origin + "/api/public/health", {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!apiHealth.ok) throw Error("API HTTPS directe indisponible.");
  return result;
}
async function main() {
  if (action === "prepare") {
    await prepare(envFile);
    console.log(
      "Profil privé et clés distinctes créés. Compléter les champs manquants ; aucun secret affiché.",
    );
    return;
  }
  if (action === "smoke") {
    console.log(JSON.stringify(await publicSmoke()));
    return;
  }
  if (!["check", "migrate", "setup", "worker", "backup"].includes(action))
    throw Error(
      "Usage : control.mjs prepare|check|migrate|setup|worker|backup --env-file /chemin/prive/api.env ; smoke après déploiement.",
    );
  await configuration();
  if (action === "check" && !args.includes("--network")) {
    console.log(
      "Configuration privée valide ; aucun accès réseau ni changement de base effectué.",
    );
    return;
  }
  const { db, migrate } = require("../../api/dist/db.js");
  try {
    const info = await inspectDatabase(db);
    if (action === "check") {
      if (process.env.BREVO_API_KEY) {
        const result = await fetch("https://api.brevo.com/v3/account", {
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: { "api-key": process.env.BREVO_API_KEY },
        });
        if (!result.ok)
          throw Error(`Accès Brevo refusé (HTTP ${result.status}).`);
        console.log(
          JSON.stringify({ ...info, brevo: "verified, no email sent" }),
        );
        return;
      }
      const transport = apiRequire("nodemailer").createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_PORT === "465",
        requireTLS: true,
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      try {
        await transport.verify();
      } finally {
        transport.close();
      }
      console.log(JSON.stringify({ ...info, smtp: "verified, no email sent" }));
    } else if (action === "backup") {
      const outputFlag = args.indexOf("--output");
      const output = privateLocation(
        outputFlag >= 0 ? args[outputFlag + 1] : null,
      );
      const { backup } = await import("../../scripts/backup.mjs");
      await backup(output);
      console.log("Sauvegarde chiffrée créée ; aucune donnée affichée.");
    } else if (action === "migrate") {
      await migrate();
      console.log("Migrations appliquées, aucun dossier ni compte préchargé.");
    } else if (action === "setup") {
      await migrate();
      const { assertNoDemoData } = require("../../api/dist/production.js");
      await assertNoDemoData(db);
      const { initializeSchool } = require("../../api/dist/initialize.js");
      await initializeSchool({
        name: process.env.EDUBEST_ADMIN_NAME || "",
        email: process.env.EDUBEST_ADMIN_EMAIL || "",
        password: process.env.EDUBEST_ADMIN_PASSWORD || "",
      });
      console.log(
        "Premier responsable créé. Retirer son mot de passe de la configuration et activer sa MFA.",
      );
    } else if (action === "worker") {
      if (!info.schema_present)
        throw Error(
          "Migrations et initialisation requises avant la tâche de livraison.",
        );
      const lock = await db.connect();
      try {
        if (
          !(await lock.query("SELECT pg_try_advisory_lock(812351) AS acquired"))
            .rows[0].acquired
        )
          return;
        await db.query(
          "UPDATE outbox SET state='pending' WHERE state='sending' AND next_at<now()",
        );
        const { deliver } = require("../../api/dist/mail.js");
        const deadline = Date.now() + 40000;
        let processed = 0;
        while (processed < 25 && Date.now() < deadline) {
          const pending = (
            await db.query(
              "SELECT 1 FROM outbox WHERE state='pending' AND next_at<=now() LIMIT 1",
            )
          ).rowCount;
          if (!pending) break;
          await deliver();
          processed++;
        }
        const { maintainSecurity } = require("../../api/dist/protection.js");
        await maintainSecurity();
        console.log(
          JSON.stringify({ worker: "completed", attempted: processed }),
        );
      } finally {
        await lock.query("SELECT pg_advisory_unlock(812351)");
        lock.release();
      }
    }
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(
      error.message?.startsWith("Configuration de production refusée :")
        ? error.message
        : "Opération refusée : vérifier le profil privé, les prérequis et les champs manquants. Aucun secret affiché.",
    );
    process.exitCode = 1;
  });
