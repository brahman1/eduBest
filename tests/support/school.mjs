import { db } from "../../api/dist/db.js";
import { initializeSchool } from "../../api/dist/initialize.js";
export async function resetTestSchool() {
  // Destructive fixtures are allowed ONLY against this explicitly named test database.
  const name = (await db.query("SELECT current_database() AS name")).rows[0]
    .name;
  if (name !== "edubest_test" || process.env.EDUBEST_TEST_DATABASE !== "true")
    throw new Error(
      "Tests destructifs refusés hors de edubest_test explicitement activée.",
    );
  await db.query(
    "TRUNCATE tenants CASCADE; TRUNCATE outbox, rate_buckets, security_events;",
  );
}
export async function provision(email, password, verified = true) {
  const result = await initializeSchool({
    email,
    password,
    name: "Direction fictive",
  });
  if (!verified)
    await db.query("UPDATE users SET verified=false WHERE id=$1", [
      result.userId,
    ]);
  return result;
}
export const closeTestDb = () => db.end();
