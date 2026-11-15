/** Deployment validation. Error messages never contain configuration values. */
import { deploymentProfile } from "./deployment";
const {
  reviewEnabled,
  validateReview,
} = require("@edubest/shared/review-policy.cjs");
const {
  productionDatabaseName,
} = require("@edubest/shared/database-policy.cjs");
export function publicHttps(value: string | undefined): boolean {
  try {
    const u = new URL(value ?? "");
    const h = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      !u.port &&
      h.includes(".") &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/.test(h) &&
      !/^172\.(1[6-9]|2\d|3[01])\./.test(h) &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(h) &&
      !/(^|\.)(localhost|local|test|invalid|example)$/.test(h) &&
      !/(^|\.)example\.(com|net|org)$/.test(h)
    );
  } catch {
    return false;
  }
}
export function validateProduction(env: NodeJS.ProcessEnv = process.env) {
  if (reviewEnabled(env)) validateReview(env);
  if (env.NODE_ENV !== "production") return;
  const invalid: string[] = [];
  const profile = deploymentProfile(env);
  for (const [field, minimum] of [
    ["SCHOOL_LEGAL_NAME", 3],
    ["SCHOOL_ADDRESS", 8],
    ["DATA_HOSTING_DESCRIPTION", 15],
    ["DATA_RETENTION_POLICY", 30],
    ["DATA_PROCESSING_BASIS", 30],
  ] as const) {
    const value = env[field]?.trim() ?? "";
    if (
      value.length < minimum ||
      /à (compléter|renseigner)|a completer|TODO|TBD|placeholder|change.?me/i.test(
        value,
      )
    )
      invalid.push(field);
  }
  for (const [field, value] of [
    ["SCHOOL_CONTACT_EMAIL", profile.contact_email],
    ["SCHOOL_PRIVACY_EMAIL", profile.privacy_email],
  ])
    if (
      !/^[^\s@<>]+@[^\s@<>]+$/.test(value) ||
      !publicHttps(`https://${value.split("@")[1]}`)
    )
      invalid.push(field);
  if (env.EDUBEST_DEMO_ENABLED !== "false" || env.EDUBEST_DEMO_PASSWORD)
    invalid.push("EDUBEST_DEMO_ENABLED=false (aucun secret de démonstration)");
  try {
    const db = new URL(env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.username ||
      !db.password ||
      !(
        reviewEnabled(env) ||
        productionDatabaseName(decodeURIComponent(db.pathname.slice(1)), env)
      ) ||
      /local_only|changeme|replace|example/i.test(
        decodeURIComponent(db.password),
      )
    )
      invalid.push("DATABASE_URL (base EduBest dédiée)");
  } catch {
    invalid.push("DATABASE_URL");
  }
  if (!publicHttps(env.WEB_URL) || new URL(env.WEB_URL!).pathname !== "/")
    invalid.push("WEB_URL (origine HTTPS publique)");
  const origins = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim());
  if (
    !origins.length ||
    origins.some((x) => !publicHttps(x) || new URL(x).pathname !== "/") ||
    !origins.includes(env.WEB_URL ?? "")
  )
    invalid.push("ALLOWED_ORIGINS");
  if (
    !env.SECURITY_ENCRYPTION_KEY ||
    !/^[a-f0-9]{64,}$/i.test(env.SECURITY_ENCRYPTION_KEY) ||
    new Set(env.SECURITY_ENCRYPTION_KEY).size < 8
  )
    invalid.push("SECURITY_ENCRYPTION_KEY");
  if (!reviewEnabled(env)) {
    if (!env.BREVO_API_KEY) {
      if (
        !env.SMTP_HOST ||
        /localhost|127\.0\.0\.1|mailpit|example/i.test(env.SMTP_HOST)
      )
        invalid.push("SMTP_HOST");
      if (!["465", "587"].includes(env.SMTP_PORT ?? ""))
        invalid.push("SMTP_PORT (465 ou 587)");
      if (!env.SMTP_USER || !env.SMTP_PASSWORD)
        invalid.push("SMTP_USER / SMTP_PASSWORD");
    }
    const from = env.SMTP_FROM?.match(/<?([^\s<>]+@[^\s<>]+)>?$/)?.[1];
    if (!from || !publicHttps(`https://${from.split("@")[1]}`))
      invalid.push("SMTP_FROM");
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    invalid.push("NODE_TLS_REJECT_UNAUTHORIZED");
  if (invalid.length)
    throw new Error(
      "Configuration de production refusée : " + invalid.join(", "),
    );
}

type Queryable = {
  query: (sql: string) => Promise<{ rows: any[]; rowCount: number | null }>;
};
export async function assertNoDemoData(db: Queryable) {
  const marker = await db.query(
    "SELECT to_regclass('public.demo_initialization') AS marker",
  );
  if (marker.rows[0]?.marker)
    throw new Error(
      "Base de démonstration refusée. Utiliser une nouvelle base vide dédiée à EduBest.",
    );
  const found = await db.query(
    "SELECT 1 FROM users WHERE lower(email) ~ '@[^@]*\\.(test|invalid|example)$' OR lower(email) ~ '@example\\.(com|net|org)$' LIMIT 1",
  );
  if (found.rowCount)
    throw new Error("Comptes de test refusés dans la base de production.");
}
