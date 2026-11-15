// Creates a NEW local database and its restricted role. Never resets any database.
import { Pool } from "pg";
import dotenv from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const file = new URL("../.local/review/api.env", import.meta.url);
const config = dotenv.parse(await readFile(file));
if (
  config.DATABASE_URL !==
  "postgres://edubest_review:CONFIGURE_PRIVATE_PASSWORD@127.0.0.1:5448/edubest_review"
)
  throw Error(
    "Configuration déjà modifiée : aucune création ni rotation automatique.",
  );
// Read existing LOCAL credentials privately; no password is embedded or logged.
const local = dotenv.parse(await readFile(new URL("../.env", import.meta.url)));
const url = new URL(local.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5448" ||
  url.pathname !== "/edubest"
)
  throw Error(
    "Seule l’instance PostgreSQL locale EduBest sur le port 5448 est autorisée.",
  );
url.pathname = "/postgres";
const admin = new Pool({ connectionString: url.href });
try {
  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname='edubest_review' UNION ALL SELECT 1 FROM pg_roles WHERE rolname='edubest_review'",
  );
  if (existing.rowCount)
    throw Error("Base ou rôle déjà existant. Aucun remplacement automatique.");
  const secret = randomBytes(32).toString("hex");
  await admin.query(
    `CREATE ROLE edubest_review LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
  );
  await admin.query("CREATE DATABASE edubest_review OWNER edubest_review");
  await admin.query("REVOKE ALL ON DATABASE edubest_review FROM PUBLIC");
  config.DATABASE_URL = `postgres://edubest_review:${secret}@127.0.0.1:5448/edubest_review`;
  await writeFile(
    file,
    Object.entries(config)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Nouvelle base locale et rôle restreint créés. Secrets conservés dans .local/review/api.env.",
  );
} finally {
  await admin.end();
}
