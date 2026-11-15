import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";
import dotenv from "dotenv";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
const config = dotenv.parse(
  await readFile(resolve(root, ".local/review/api.env")),
);
// Exercise the actual production-mode validation on the LOCAL isolated DB.
Object.assign(config, {
  NODE_ENV: "production",
  WEB_URL: "https://demo.edubest.dz",
  ALLOWED_ORIGINS: "https://demo.edubest.dz",
});
const checkedConfig = resolve(root, ".local/review/production-check.env");
await writeFile(
  checkedConfig,
  Object.entries(config)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
const env = { ...process.env, ...config, API_BIND: "127.0.0.1" };
const server = spawn(
  process.execPath,
  ["ops/review-server.cjs", checkedConfig],
  { cwd: root, env, stdio: "ignore", windowsHide: true },
);
const base = "http://127.0.0.1:4250/api";
const report = {
  date: new Date().toISOString(),
  scope: "local isolated review database",
  checks: [],
  roles: [],
};
const db = new Pool({ connectionString: config.DATABASE_URL });
async function request(path, token, method = "GET", body) {
  return fetch(`${base}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token || "mobile"}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${base}/public/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal((await request("students")).status, 401);
  report.checks.push("Unauthenticated school records refused");
  for (const [role, email] of [
    ["OWNER", "direction@edubest.test"],
    ["STUDENT", "eleve@edubest.test"],
    ["PARENT", "parent@edubest.test"],
    ["TEACHER", "professeur@edubest.test"],
  ]) {
    const login = await request("auth/login", null, "POST", {
      email,
      password: config.EDUBEST_REVIEW_PASSWORD,
    });
    assert.equal(login.status, 201);
    const { token } = await login.json();
    assert.equal(typeof token, "string");
    const me = await (await request("auth/me", token)).json();
    assert.equal(me.role, role);
    const response = await request("dashboard", token);
    assert.equal(response.status, 200);
    const dashboard = await response.json();
    if (role === "STUDENT") assert.equal(dashboard.personal.children.length, 1);
    if (role === "PARENT") assert.ok(dashboard.personal.children.length >= 2);
    assert.equal(
      (await request("users", token)).status,
      role === "OWNER" ? 200 : 403,
    );
    if (role !== "OWNER")
      assert.equal((await request("groups", token, "POST", {})).status, 403);
    report.roles.push({
      role,
      login: true,
      dashboard: true,
      restrictedAdministration: role !== "OWNER",
    });
    await request("auth/logout", token, "POST", {});
  }
  const counts = (
    await db.query(
      "SELECT (SELECT count(*)::int FROM students) AS students,(SELECT count(*)::int FROM groups) AS groups,(SELECT count(*)::int FROM payments) AS payments,(SELECT count(*)::int FROM lessons) AS lessons",
    )
  ).rows[0];
  assert.ok(
    counts.students > 4 &&
      counts.groups > 2 &&
      counts.payments > 0 &&
      counts.lessons > 0,
  );
  report.fixtureCounts = counts;
  // The demo DB principal must have no access to the local school tables.
  const other = new URL(config.DATABASE_URL);
  other.pathname = "/edubest";
  const foreign = new Pool({ connectionString: other.href });
  try {
    await assert.rejects(
      () => foreign.query("SELECT id FROM tenants LIMIT 1"),
      (e) => ["42501", "28000", "28P01"].includes(e.code),
    );
  } finally {
    await foreign.end();
  }
  report.checks.push(
    "Review database role cannot read the local school database",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM outbox WHERE state='sent'"))
      .rows[0].n,
    0,
  );
  report.checks.push("No external email or push delivery");
  report.success = true;
} finally {
  server.kill();
  await db.end();
  await mkdir(resolve(root, "verification"), { recursive: true });
  await writeFile(
    resolve(root, "verification/review-isolation-local-20261029.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report, null, 2));
