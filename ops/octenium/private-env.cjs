"use strict";
const fs = require("node:fs");
const path = require("node:path");
function privateLocation(value) {
  if (!value || !path.isAbsolute(value))
    throw Error("Chemin absolu du fichier privé requis.");
  const target = path.resolve(value);
  if (
    target
      .split(/[\\/]/)
      .some((p) => ["public_html", "www", "htdocs"].includes(p.toLowerCase()))
  )
    throw Error("Le fichier privé doit rester hors du répertoire public.");
  return target;
}
function loadPrivateEnvironment(
  value = process.env.EDUBEST_ENV_FILE,
  target = process.env,
) {
  const file = privateLocation(value);
  const info = fs.statSync(file);
  if (!info.isFile() || info.size > 65536)
    throw Error("Fichier privé non valide.");
  privateLocation(fs.realpathSync(file));
  if (process.platform !== "win32" && info.mode & 0o077)
    throw Error("Permissions 600 requises pour le fichier privé.");
  const values = require("dotenv").parse(fs.readFileSync(file));
  if (
    values.NODE_ENV !== "production" ||
    values.EDUBEST_DEMO_ENABLED !== "false"
  )
    throw Error("Profil privé de production requis, sans démonstration.");
  if (values.EDUBEST_TEST_DATABASE || values.EDUBEST_DEMO_PASSWORD)
    throw Error("Configuration de test interdite.");
  Object.assign(target, values);
  delete target.EDUBEST_TEST_DATABASE;
  delete target.EDUBEST_DEMO_PASSWORD;
  return { file, values };
}
const { requireRuntime } = require("./runtime-check.cjs");
module.exports = { privateLocation, loadPrivateEnvironment, requireRuntime };
