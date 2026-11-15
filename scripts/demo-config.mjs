import "dotenv/config";
import policy from "../shared/review-policy.cjs";

export function demoConfig(env = process.env) {
  if (policy.reviewEnabled(env)) {
    policy.validateReview(env);
    if ((env.EDUBEST_REVIEW_PASSWORD ?? "").length < 24)
      throw Error(
        "Mot de passe privé de revue requis (24 caractères minimum).",
      );
    return {
      connection: env.DATABASE_URL,
      password: env.EDUBEST_REVIEW_PASSWORD,
      cloud: true,
    };
  }
  if (env.NODE_ENV === "production")
    throw new Error("La démonstration est interdite en production.");
  const connection =
    env.DATABASE_URL ??
    "postgres://edubest:edubest_local_only@127.0.0.1:5448/edubest";
  const cloud = env.RENDER === "true" && env.EDUBEST_DEMO_ENABLED === "true";
  if (cloud) {
    if (
      env.RENDER !== "true" ||
      !env.DATABASE_URL ||
      !env.EDUBEST_DEMO_PASSWORD ||
      env.EDUBEST_DEMO_PASSWORD.length < 20 ||
      env.EDUBEST_DEMO_PASSWORD === "EduBest-Local-2026!"
    )
      throw new Error(
        "La démonstration hébergée exige Render, une base dédiée et un mot de passe de test distinct (20 caractères minimum).",
      );
  } else if (
    env.EDUBEST_DEMO_ENABLED !== "true" ||
    env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(new URL(connection).hostname)
  ) {
    throw new Error(
      "Démonstration refusée : activer EDUBEST_DEMO_ENABLED=true dans une base de test locale dédiée.",
    );
  }
  return {
    connection,
    cloud,
    password: cloud ? env.EDUBEST_DEMO_PASSWORD : "EduBest-Local-2026!",
  };
}
