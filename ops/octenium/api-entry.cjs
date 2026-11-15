"use strict";
try {
  const {
    loadPrivateEnvironment,
    requireRuntime,
  } = require("./private-env.cjs");
  requireRuntime();
  loadPrivateEnvironment();
  // Separate Passenger applications: exactly one listener in this process.
  require("../../api/dist/main.js");
} catch {
  console.error(
    "EduBest API : vérifier Node 22 et le profil privé de production.",
  );
  process.exitCode = 1;
}
