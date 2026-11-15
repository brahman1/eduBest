import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProduction,
  assertNoDemoData,
  publicHttps,
} from "../api/dist/production.js";

const valid = {
  NODE_ENV: "production",
  EDUBEST_DEMO_ENABLED: "false",
  SCHOOL_LEGAL_NAME: "École fictive pour les tests de configuration",
  SCHOOL_ADDRESS: "Adresse fictive du test, Algérie",
  SCHOOL_CONTACT_EMAIL: "direction@edubest.fr",
  DATA_HOSTING_DESCRIPTION:
    "Description fictive pour la validation de configuration uniquement.",
  DATA_RETENTION_POLICY:
    "Durées fictives utilisées uniquement dans un test de configuration isolé.",
  DATA_PROCESSING_BASIS:
    "Fondements fictifs utilisés uniquement dans un test de configuration isolé.",
  DATABASE_URL:
    "postgresql://edubest:89abc709df5412abcdeffe0102828fed@db:5432/edubest",
  WEB_URL: "https://school.edubest.fr",
  ALLOWED_ORIGINS: "https://school.edubest.fr",
  SECURITY_ENCRYPTION_KEY: "0123456789abcdef".repeat(4),
  SMTP_HOST: "smtp.resend.com",
  SMTP_PORT: "587",
  SMTP_USER: "resend",
  SMTP_PASSWORD: "unit-only-password",
  SMTP_FROM: "EduBest <contact@edubest.fr>",
};
test("Production : configuration explicite complète et sans compte préchargé", () => {
  assert.doesNotThrow(() => validateProduction(valid));
  assert.doesNotThrow(() => validateProduction({ NODE_ENV: "development" }));
});
for (const [key, value] of [
  ["SCHOOL_LEGAL_NAME", ""],
  ["SCHOOL_ADDRESS", "À compléter"],
  ["SCHOOL_CONTACT_EMAIL", "contact@localhost"],
  ["DATA_HOSTING_DESCRIPTION", "TODO"],
  ["DATA_RETENTION_POLICY", undefined],
  ["DATA_PROCESSING_BASIS", "À renseigner"],
  ["NODE_TLS_REJECT_UNAUTHORIZED", "0"],
  ["EDUBEST_DEMO_ENABLED", "true"],
  ["EDUBEST_DEMO_ENABLED", undefined],
  ["EDUBEST_DEMO_PASSWORD", "secret"],
  ["DATABASE_URL", undefined],
  ["DATABASE_URL", "postgres://edubest:local_only@localhost/edubest"],
  ["DATABASE_URL", "postgres://edubest:some-password@db/midad"],
  ["WEB_URL", "http://school.edubest.fr"],
  ["WEB_URL", "https://127.0.0.1"],
  ["WEB_URL", "https://edubest.example.com"],
  ["ALLOWED_ORIGINS", "*"],
  ["SECURITY_ENCRYPTION_KEY", "a".repeat(64)],
  ["SMTP_HOST", "mailpit"],
  ["SMTP_PORT", "25"],
  ["SMTP_PASSWORD", ""],
  ["SMTP_FROM", "contact@localhost"],
])
  test(`Production : refus de ${key} non exploitable (${String(value)})`, () => {
    assert.throws(() => validateProduction({ ...valid, [key]: value }));
  });
test("Adresses publiques : refuse identifiants, IP privées, exemples et paramètres", () => {
  for (const url of [
    "https://192.168.0.5",
    "https://172.16.1.1",
    "https://localhost",
    "https://fake.test",
    "https://user:secret@edubest.fr",
    "https://edubest.fr?token=x",
  ])
    assert.equal(publicHttps(url), false);
});
test("Production : une base marquée démonstration est refusée sans écriture", async () => {
  const seen = [];
  await assert.rejects(
    assertNoDemoData({
      query: async (sql) => {
        seen.push(sql);
        return { rows: [{ marker: "demo_initialization" }], rowCount: 1 };
      },
    }),
  );
  assert.equal(seen.length, 1);
  assert.ok(seen.every((sql) => sql.startsWith("SELECT")));
});
test("Production : un compte de test est refusé et une base vide est acceptée", async () => {
  for (const count of [0, 1]) {
    let i = 0;
    const check = assertNoDemoData({
      query: async () =>
        ++i === 1
          ? { rows: [{ marker: null }], rowCount: 1 }
          : { rows: [], rowCount: count },
    });
    if (count) await assert.rejects(check);
    else await check;
  }
});
