"use strict";
// One naming policy for application startup, backups and cPanel preparation.
function account(env) {
  const value = env.EDUBEST_CPANEL_ACCOUNT || "";
  return /^[a-z][a-z0-9]{0,15}$/.test(value) && !/midad/i.test(value)
    ? value
    : null;
}
function scopedMatch(name, env, pattern) {
  if (typeof name !== "string" || name.length > 63 || /midad/i.test(name))
    return false;
  if (pattern.test(name)) return true;
  const prefix = account(env);
  return (
    !!prefix &&
    name.startsWith(prefix + "_") &&
    pattern.test(name.slice(prefix.length + 1))
  );
}
function productionDatabaseName(name, env = process.env) {
  return scopedMatch(name, env, /^edubest(?:_production)?$/);
}
function backupDatabaseName(name, env = process.env) {
  return (
    (name === "edubest_test" && env.EDUBEST_TEST_DATABASE === "true") ||
    productionDatabaseName(name, env)
  );
}
function restoreDatabaseName(name, env = process.env) {
  if (name === "edubest_test") return env.EDUBEST_TEST_DATABASE === "true";
  return scopedMatch(name, env, /^edubest_restore_[a-z0-9_]+$/);
}
module.exports = {
  account,
  productionDatabaseName,
  backupDatabaseName,
  restoreDatabaseName,
};
