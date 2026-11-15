import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validateProduction } = require("../api/dist/production.js");
try {
  if (process.env.NODE_ENV !== "production")
    throw new Error("NODE_ENV=production requis.");
  validateProduction();
  console.log(
    "Configuration serveur de production valide. Aucune connexion ni modification de base effectuée.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
