// Read-only database permission diagnostics; never prints connection secrets or school data.
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { Pool } from "pg";
import policy from "../shared/review-policy.cjs";
const env = dotenv.parse(await readFile(process.argv[2]));
policy.validateReview(env);
const db = new Pool({ connectionString: env.DATABASE_URL });
try {
  const result =
    await db.query(`SELECT current_database() AS db,current_user AS username,
    r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
    ARRAY(SELECT parent.rolname FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid WHERE m.member=r.oid) AS memberships,
    has_database_privilege(current_user,'ggcsckht_edubest','CONNECT') AS real_db_connect,
    has_database_privilege(current_user,'ggcsckht_edubest','CREATE') AS real_db_create
    FROM pg_roles r WHERE rolname=current_user`);
  console.log(JSON.stringify(result.rows[0]));
  console.log(
    JSON.stringify(
      (
        await db.query(
          "SELECT count(*)::int AS public_tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
        )
      ).rows[0],
    ),
  );
} finally {
  await db.end();
}
