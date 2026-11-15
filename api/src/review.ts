const {
  reviewEnabled,
  validateReview,
} = require("@edubest/shared/review-policy.cjs");
export { reviewEnabled };
type Queryable = {
  query: (
    sql: string,
    values?: any[],
  ) => Promise<{ rows: any[]; rowCount: number | null }>;
};
export function assertReviewRoles(
  roles: any[],
  username: string,
  database: string,
) {
  if (
    !roles.some((r) => r.rolname === username) ||
    roles.some(
      (r) =>
        ![username, database].includes(r.rolname) ||
        r.rolsuper ||
        r.rolcreatedb ||
        r.rolcreaterole ||
        r.rolreplication ||
        r.rolbypassrls ||
        (r.rolname !== username && r.rolcanlogin),
    )
  )
    throw Error(
      "La revue accepte uniquement son utilisateur et son rôle cPanel de base dédié, sans privilèges administratifs.",
    );
}
/** Checked before migrations as well as before accepting any request. */
export async function assertReviewDatabase(db: Queryable, seeded = false) {
  validateReview();
  const row = (
    await db.query(`SELECT current_database() AS db,current_user AS username,
    r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
    (SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships
    FROM pg_roles r WHERE rolname=current_user`)
  ).rows[0];
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !row ||
    row.db !== decodeURIComponent(url.pathname.slice(1)) ||
    row.username !== decodeURIComponent(url.username) ||
    row.rolsuper ||
    row.rolcreatedb ||
    row.rolcreaterole ||
    row.rolreplication ||
    row.rolbypassrls
  )
    throw Error(
      "Rôle PostgreSQL de revue trop privilégié ou base incohérente.",
    );
  const roles = (
    await db.query(`WITH RECURSIVE inherited(oid) AS (
    SELECT oid FROM pg_roles WHERE rolname=current_user
    UNION SELECT m.roleid FROM pg_auth_members m JOIN inherited i ON m.member=i.oid
  ) SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls
    FROM pg_roles r JOIN inherited i ON r.oid=i.oid`)
  ).rows;
  assertReviewRoles(roles, row.username, row.db);
  const externalPrivileges = await db.query(
    `SELECT datname FROM pg_database d
    WHERE datname<>current_database() AND (
      has_database_privilege(current_user,d.oid,'CREATE') OR
      datdba IN (SELECT oid FROM pg_roles WHERE rolname=ANY($1::text[]))
    )`,
    [roles.map((r) => r.rolname)],
  );
  if (externalPrivileges.rowCount)
    throw Error(
      "Le rôle de revue possède des droits sur une autre base. Démarrage refusé.",
    );
  if (seeded) {
    const marker = (
      await db.query("SELECT instance FROM review_initialization")
    ).rows;
    if (
      marker.length !== 1 ||
      marker[0].instance !== process.env.EDUBEST_REVIEW_INSTANCE
    )
      throw Error("Instance de revue non initialisée ou incohérente.");
  }
}
