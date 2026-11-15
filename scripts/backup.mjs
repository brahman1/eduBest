import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { encryptDump, authenticatedDump, backupKey } from "./backup-crypto.mjs";
import databasePolicy from "../shared/database-policy.cjs";

function pgEnv(url) {
  const u = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    !u.hostname ||
    u.hash
  )
    throw new Error("Adresse PostgreSQL invalide.");
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGSSLMODE:
      u.searchParams.get("sslmode") || process.env.PGSSLMODE || "prefer",
    PGCONNECT_TIMEOUT: "5",
  };
}
function tool(name) {
  return process.env.EDUBEST_PG_BIN
    ? join(
        process.env.EDUBEST_PG_BIN,
        name + (process.platform === "win32" ? ".exe" : ""),
      )
    : name;
}
function launch(name, args, env, stdin = "ignore") {
  const child = spawn(tool(name), args, {
    env,
    windowsHide: true,
    stdio: [stdin, "pipe", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors = (errors + chunk).slice(-2000);
  });
  const done = new Promise((accept, reject) => {
    child.once("error", () =>
      reject(new Error(`Outil PostgreSQL indisponible : ${name}`)),
    );
    child.once("close", (code) =>
      code === 0
        ? accept()
        : reject(
            new Error(
              `${name} a échoué. Vérifiez la connexion et les journaux PostgreSQL.`,
              { cause: new Error(errors) },
            ),
          ),
    );
  });
  // Prevent an early child error from becoming an unhandled rejection during a stream pipeline.
  void done.catch(() => {});
  return { child, done };
}
async function query(sql, env) {
  const { child, done } = launch(
    "psql",
    ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    env,
  );
  let value = "";
  for await (const chunk of child.stdout) value += chunk;
  await done;
  return value.trim();
}
function targetAllowed(name, restore) {
  return restore
    ? databasePolicy.restoreDatabaseName(name)
    : databasePolicy.backupDatabaseName(name);
}
export async function backup(output) {
  const env = pgEnv(process.env.DATABASE_URL ?? "");
  if (!targetAllowed(env.PGDATABASE, false))
    throw new Error("Base de sauvegarde EduBest refusée.");
  const key = await backupKey(process.env.EDUBEST_BACKUP_KEY_FILE ?? "");
  if ((await query("SELECT current_database()", env)) !== env.PGDATABASE)
    throw new Error("Base inattendue.");
  output = resolve(output);
  await mkdir(dirname(output), { recursive: true });
  // Exclusive final name prevents overwriting an earlier backup.
  const temporary = output + ".partial-" + randomUUID();
  const { child, done } = launch(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl"],
    env,
  );
  try {
    await Promise.all([encryptDump(child.stdout, temporary, key), done]);
    const { link } = await import("node:fs/promises");
    await link(temporary, output);
    await rm(temporary);
  } catch (error) {
    child.kill();
    await rm(temporary, { force: true });
    throw error;
  }
  return output;
}
export async function restore(input) {
  const env = pgEnv(process.env.EDUBEST_RESTORE_DATABASE_URL ?? "");
  if (!targetAllowed(env.PGDATABASE, true))
    throw new Error(
      "Restauration refusée : base neuve edubest_restore_* requise.",
    );
  const key = await backupKey(process.env.EDUBEST_BACKUP_KEY_FILE ?? "");
  const dump = await authenticatedDump(resolve(input), key);
  try {
    if ((await query("SELECT current_database()", env)) !== env.PGDATABASE)
      throw new Error("Base inattendue.");
    const tables = await query(
      "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f','S')",
      env,
    );
    if (tables !== "0")
      throw new Error(
        "Restauration refusée : la base cible contient déjà des objets.",
      );
    const { child, done } = launch(
      "pg_restore",
      [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
        "--dbname",
        env.PGDATABASE,
      ],
      env,
      "pipe",
    );
    try {
      await Promise.all([
        pipeline(createReadStream(dump.path), child.stdin),
        done,
      ]);
    } catch (error) {
      child.kill();
      throw error;
    }
  } finally {
    await dump.dispose();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, path, confirmation] = process.argv.slice(2);
  try {
    if (
      !path ||
      !["create", "restore"].includes(command) ||
      (command === "restore" && confirmation !== "--confirm-empty")
    )
      throw new Error(
        "Usage : node scripts/backup.mjs create fichier.edubest-backup | restore fichier.edubest-backup --confirm-empty",
      );
    if (command === "create") {
      await backup(path);
      console.log("Sauvegarde chiffrée créée.");
    } else {
      await restore(path);
      console.log("Restauration terminée sur la base isolée.");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
