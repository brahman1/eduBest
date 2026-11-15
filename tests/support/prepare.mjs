import { db, migrate } from "../../api/dist/db.js";
try {
  const name = (await db.query("SELECT current_database() AS name")).rows[0]
    .name;
  if (name !== "edubest_test" || process.env.EDUBEST_TEST_DATABASE !== "true")
    throw new Error(
      "Préparation refusée hors de edubest_test explicitement activée.",
    );
  await db.query("CREATE SCHEMA IF NOT EXISTS public");
  await migrate();
  console.log("Base de test préparée.");
} finally {
  await db.end();
}
