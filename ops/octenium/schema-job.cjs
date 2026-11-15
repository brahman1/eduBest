"use strict";
// Offline job only: never import this module from a web entrypoint.
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
async function run() {
  const configFile = path.join(__dirname, "database.json");
  const mode = fs.statSync(configFile).mode;
  if (process.platform !== "win32" && mode & 0o077)
    throw Object.assign(Error("Private permissions required"), {
      code: "PRIVATE_FILE",
    });
  const { connectionString } = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const url = new URL(connectionString);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.200" ||
    url.pathname !== "/ggcsckht_edubest" ||
    decodeURIComponent(url.username) !== "ggcsckht_app"
  )
    throw Object.assign(Error("Dedicated database required"), {
      code: "DATABASE_SCOPE",
    });
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    lock_timeout: 5000,
  });
  await client.connect();
  try {
    const info = (
      await client.query(
        "SELECT current_database() AS name,current_setting('server_version_num')::int AS version",
      )
    ).rows[0];
    if (info.name !== "ggcsckht_edubest" || info.version < 160015)
      throw Object.assign(Error("Database scope or version refused"), {
        code: "DATABASE_SCOPE",
      });
    const existing = (
      await client.query(
        "SELECT to_regclass('public.schema_migrations') AS present",
      )
    ).rows[0].present;
    if (!existing)
      await client.query(
        fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"),
      );
    const versions = (
      await client.query("SELECT count(*)::int AS n FROM schema_migrations")
    ).rows[0].n;
    if (versions !== 7)
      throw Object.assign(Error("Unexpected schema"), {
        code: "MIGRATION_COUNT",
      });
    const counts = {};
    for (const table of [
      "tenants",
      "users",
      "students",
      "groups",
      "invoices",
      "payments",
    ])
      counts[table] = (
        await client.query("SELECT count(*)::int AS n FROM " + table)
      ).rows[0].n;
    if (Object.values(counts).some((n) => n !== 0))
      throw Object.assign(Error("Installation requires no records"), {
        code: "DATABASE_NOT_EMPTY",
      });
    const result = {
      status: "schema_ready",
      postgresql: info.version,
      migrations: versions,
      counts,
      public_app_connected: false,
    };
    fs.writeFileSync(
      path.join(__dirname, "schema-result.json"),
      JSON.stringify(result, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}
run().catch((error) => {
  console.error(
    JSON.stringify({
      status: "refused",
      code: error.code || "INSTALLATION_ERROR",
    }),
  );
  process.exitCode = 1;
});
