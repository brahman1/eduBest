import "dotenv/config";
import dotenv from "dotenv";
import { Pool, PoolClient, types } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateProduction } from "./production";
dotenv.config({ path: resolve(process.cwd(), "../.env"), quiet: true });
validateProduction();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL requis");
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1082, (v) => v);
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  lock_timeout: 5000,
  idle_in_transaction_session_timeout: 15000,
});
export async function transaction<T>(
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function migrate() {
  const c = await db.connect();
  try {
    await c.query("SELECT pg_advisory_lock(812348)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const folder = resolve(__dirname, "../migrations");
    for (const file of readdirSync(folder)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (
        (
          await c.query("SELECT 1 FROM schema_migrations WHERE version=$1", [
            file,
          ])
        ).rowCount
      )
        continue;
      await c.query("BEGIN");
      try {
        await c.query(readFileSync(resolve(folder, file), "utf8"));
        await c.query("INSERT INTO schema_migrations(version) VALUES($1)", [
          file,
        ]);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await c.query("SELECT pg_advisory_unlock(812348)");
    c.release();
  }
}
