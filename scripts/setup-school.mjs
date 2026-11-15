import dotenv from "dotenv";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const root = resolve(import.meta.dirname, "..");
dotenv.config({ path: resolve(root, ".env"), quiet: true });
process.chdir(resolve(root, "api"));
const require = createRequire(import.meta.url);
const { db, migrate } = require("../api/dist/db.js");
try {
  await migrate();
  if (process.env.NODE_ENV === "production") {
    const {
      assertNoDemoData,
      publicHttps,
    } = require("../api/dist/production.js");
    await assertNoDemoData(db);
    if (
      process.env.EDUBEST_ADMIN_EMAIL &&
      !publicHttps(`https://${process.env.EDUBEST_ADMIN_EMAIL.split("@")[1]}`)
    )
      throw new Error("Une adresse réelle est requise pour la direction.");
  }
  const exists = (await db.query("SELECT 1 FROM tenants LIMIT 1")).rowCount;
  if (exists && process.argv.includes("--if-empty"))
    console.log("EduBest : école existante conservée.");
  else {
    if (process.env.EDUBEST_DEMO_ENABLED === "true")
      throw new Error(
        "Désactivez le mode démonstration avant l'initialisation réelle.",
      );
    const { initializeSchool } = require("../api/dist/initialize.js");
    await initializeSchool({
      email: process.env.EDUBEST_ADMIN_EMAIL ?? "",
      name: process.env.EDUBEST_ADMIN_NAME ?? "",
      password: process.env.EDUBEST_ADMIN_PASSWORD ?? "",
    });
    console.log(
      "EduBest : école et premier compte de direction créés. Retirez EDUBEST_ADMIN_PASSWORD de la configuration.",
    );
  }
} catch {
  console.error(
    "Initialisation refusée : vérifier la base dédiée, les champs EDUBEST_ADMIN_EMAIL/NAME/PASSWORD, la robustesse du mot de passe et l'absence d'école existante. Aucun compte existant n'est remplacé.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
