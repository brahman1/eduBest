import { spawnSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(import.meta.dirname, "..");
const file = resolve(root, ".local/docker-release-smoke.json");
await mkdir(resolve(root, ".local"), { recursive: true });
const profile = {
  NODE_ENV: "production",
  EDUBEST_DEMO_ENABLED: "false",
  REQUIRE_ADMIN_MFA: "true",
  DATABASE_URL: `postgresql://edubest:${randomBytes(24).toString("hex")}@db:5432/edubest`,
  WEB_URL: "https://edubest-release-check.fr",
  ALLOWED_ORIGINS: "https://edubest-release-check.fr",
  SECURITY_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SMTP_HOST: "smtp.edubest-release-check.fr",
  SMTP_PORT: "587",
  SMTP_USER: "isolated-no-email",
  SMTP_PASSWORD: randomBytes(20).toString("hex"),
  SMTP_FROM: "verification@edubest-release-check.fr",
  SCHOOL_LEGAL_NAME: "École fictive de vérification Docker",
  SCHOOL_ADDRESS: "Adresse fictive du test isolé, Algérie",
  SCHOOL_CONTACT_EMAIL: "direction@edubest-release-check.fr",
  DATA_HOSTING_DESCRIPTION:
    "Vérification Docker locale isolée ; aucun service distant ni dossier réel.",
  DATA_RETENTION_POLICY:
    "Configuration fictive réservée au test automatisé de démarrage en production.",
  DATA_PROCESSING_BASIS:
    "Configuration fictive de test sans élève, compte utilisateur ou dossier préchargé.",
};
const config = {
  services: {
    db: {
      image: "postgres:17-alpine",
      environment: {
        POSTGRES_USER: "edubest",
        POSTGRES_DB: "edubest",
        POSTGRES_PASSWORD: new URL(profile.DATABASE_URL).password,
      },
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U edubest"],
        interval: "2s",
        retries: 30,
      },
    },
    api: {
      image: "edubest-delivery-api:20261021",
      environment: profile,
      read_only: true,
      tmpfs: ["/tmp"],
      cap_drop: ["ALL"],
      security_opt: ["no-new-privileges:true"],
      depends_on: { db: { condition: "service_healthy" } },
      ports: ["127.0.0.1:4207:4200"],
    },
    web: {
      image: "edubest-delivery-web:20261021",
      environment: { API_INTERNAL_URL: "http://api:4200" },
      depends_on: { api: { condition: "service_healthy" } },
      ports: ["127.0.0.1:3107:3100"],
    },
  },
};
await writeFile(file, JSON.stringify(config), { mode: 0o600 });
const args = ["compose", "-p", "edubest-delivery-check-20261021", "-f", file];
function docker(more) {
  const result = spawnSync("docker", [...args, ...more], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(
      "Docker : " + (result.stderr || result.error?.message || "échec"),
    );
  return result.stdout;
}
try {
  docker(["up", "-d", "--wait", "--wait-timeout", "120"]);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:3107/api/public/health")).ok;
    } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, "Web et API démarrés");
  const notice = await (
    await fetch("http://127.0.0.1:3107/api/public/notice")
  ).json();
  assert.equal(notice.legal_name, profile.SCHOOL_LEGAL_NAME);
  assert.equal(notice.demo, false);
  assert.equal(notice.country, "DZ");
  assert.equal(notice.currency, "DZD");
  assert.ok(!JSON.stringify(notice).includes(profile.SECURITY_ENCRYPTION_KEY));
  for (const path of ["students", "users", "export"])
    assert.equal(
      (await fetch("http://127.0.0.1:3107/api/" + path)).status,
      401,
    );
  for (const path of ["/", "/auth", "/legal", "/account-deletion"]) {
    const response = await fetch("http://127.0.0.1:3107" + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    if (path === "/legal") assert.ok(html.includes(profile.SCHOOL_LEGAL_NAME));
    assert.ok(
      !html.includes(
        "La version locale actuelle contient des données fictives",
      ),
    );
  }
  const counts = docker([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "edubest",
    "-d",
    "edubest",
    "-tAc",
    "SELECT (SELECT count(*) FROM tenants)||'|'||(SELECT count(*) FROM users)||'|'||(SELECT count(*) FROM students)",
  ]).trim();
  assert.equal(counts, "0|0|0");
  const report = {
    date: "2026-10-21",
    status: "passed",
    node: "22.23.3",
    production: true,
    blank_database: true,
    api_read_only: true,
    unauthorized_access: "denied",
    public_pages: "passed",
    deployment_identity: "passed",
    real_customer_data: false,
  };
  await writeFile(
    resolve(root, "verification/docker-release.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  try {
    console.error(docker(["logs", "--tail", "35", "api", "web"]));
  } catch {}
  throw error;
} finally {
  docker(["down", "--remove-orphans"]);
  await rm(file, { force: true });
}
