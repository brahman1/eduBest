"use strict";
const { account } = require("./database-policy.cjs");
function reviewDatabaseName(name, env = process.env) {
  const prefix = account(env);
  return (
    name === "edubest_review" ||
    (!!prefix && name === prefix + "_edubest_review")
  );
}
function reviewEnabled(env = process.env) {
  return env.EDUBEST_REVIEW_MODE === "true";
}
function reviewUserName(name, env = process.env) {
  const prefix = account(env);
  return (
    name === "edubest_review" ||
    (!!prefix && name === prefix + "_edubest_revapp")
  );
}
function validateReview(env = process.env) {
  if (!reviewEnabled(env)) throw Error("Mode de revue non activé.");
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw Error("Base de revue requise.");
  }
  if (
    !reviewDatabaseName(decodeURIComponent(url.pathname.slice(1)), env) ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.password ||
    !reviewUserName(decodeURIComponent(url.username), env) ||
    env.EDUBEST_REVIEW_OUTBOUND !== "disabled" ||
    !/^[a-f0-9]{64}$/.test(env.EDUBEST_REVIEW_INSTANCE ?? "") ||
    env.EDUBEST_DEMO_ENABLED !== "false" ||
    [
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "BREVO_API_KEY",
      "EXPO_ACCESS_TOKEN",
    ].some((k) => !!env[k])
  )
    throw Error(
      "Revue refusée : base et utilisateur dédiés, instance et sorties désactivées requis.",
    );
}
module.exports = {
  reviewDatabaseName,
  reviewUserName,
  reviewEnabled,
  validateReview,
};
