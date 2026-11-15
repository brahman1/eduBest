"use strict";
const path = require("node:path");
const { requireRuntime } = require("./runtime-check.cjs");
try {
  requireRuntime();
  const profile = require("./public.json");
  Object.assign(process.env, {
    NODE_ENV: "production",
    EDUBEST_PUBLIC_SITE_ONLY: "true",
    SCHOOL_LEGAL_NAME: profile.legal_name,
    SCHOOL_ADDRESS: profile.address,
    SCHOOL_CONTACT_EMAIL: profile.contact_email,
    SCHOOL_PRIVACY_EMAIL: profile.privacy_email,
    HOSTNAME: "127.0.0.1",
  });
  process.env.PORT ||= "3000";
  // The public-site build has no API proxy, DB, SMTP or private configuration.
  require(path.join(__dirname, "web/server.js"));
} catch {
  console.error("EduBest : vérifier le livrable du site public et Node 22.");
  process.exitCode = 1;
}
