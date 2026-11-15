import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const files = (await readdir(resolve(root, "api/migrations")))
  .filter((f) => /^\d[\w-]*\.sql$/.test(f))
  .sort();
let sql = `-- EduBest: schema only, no users, students or payments.\n-- Run once on a NEW EMPTY dedicated database. NEVER on another application's database.\nBEGIN;\nDO $$ BEGIN\n IF current_database() = 'edubest_test' THEN\n  IF current_setting('edubest.allow_test_database', true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Explicit test database activation required'; END IF;\n ELSIF current_database() !~ '^([a-z][a-z0-9]{0,15}_)?edubest(_production)?$' OR current_database() ~* 'midad' THEN\n  RAISE EXCEPTION 'Dedicated EduBest database required';\n END IF;\n IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f','S')) THEN\n  RAISE EXCEPTION 'Database is not empty: installation refused';\n END IF;\nEND $$;\nCREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());\n`;
for (const file of files)
  sql += `\n-- Migration: ${file}\n${await readFile(resolve(root, "api/migrations", file), "utf8")}\nINSERT INTO schema_migrations(version) VALUES('${file}');\n`;
sql += "COMMIT;\n";
await mkdir(resolve(root, "ops/octenium/database"), { recursive: true });
await writeFile(resolve(root, "ops/octenium/database/schema-empty.sql"), sql);
console.log(
  `Schéma PostgreSQL généré : ${files.length} migrations, aucun compte ni dossier.`,
);
