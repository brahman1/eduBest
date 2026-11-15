"use strict";
const path = require("node:path");
const { requireRuntime } = require("./runtime-check.cjs");
try {
  requireRuntime();
  const profile = require("./public.json");
  process.env.NODE_ENV = "production";
  process.env.API_INTERNAL_URL = profile.api_origin;
  process.env.HOSTNAME = "127.0.0.1";
  process.env.PORT ||= "3000";
  require(path.join(__dirname, "web/server.js"));
} catch {
  console.error("EduBest web : vérifier Node 22 et le livrable Linux compilé.");
  process.exitCode = 1;
}
