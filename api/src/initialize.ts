import { hashPassword } from "./passwords";
import { randomUUID } from "node:crypto";
import { email, name, password, SCHOOL_SLUG } from "@edubest/shared";
import { transaction } from "./db";
/** Offline provisioning only. Never exposed as an HTTP endpoint. */
export async function initializeSchool(input: {
  email: string;
  name: string;
  password: string;
}) {
  const admin = {
    email: email.parse(input.email),
    name: name.parse(input.name),
    password: password.parse(input.password),
  };
  const encrypted = await hashPassword(admin.password);
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(812349)");
    if ((await c.query("SELECT 1 FROM tenants LIMIT 1")).rowCount)
      throw new Error(
        "École déjà initialisée : aucun compte ou mot de passe modifié.",
      );
    const schoolId = randomUUID(),
      userId = randomUUID();
    await c.query("INSERT INTO tenants(id,name,slug) VALUES($1,'EduBest',$2)", [
      schoolId,
      SCHOOL_SLUG,
    ]);
    await c.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) VALUES($1,$2,$3,$4,$5,'OWNER',true)",
      [userId, schoolId, admin.name, admin.email, encrypted],
    );
    return { schoolId, userId };
  });
}
