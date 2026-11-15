"use strict";
const fs = require("node:fs");
const path = require("node:path");
const envFile = process.env.EDUBEST_ENV_FILE || process.argv[2];
if (
  !envFile ||
  !path.isAbsolute(envFile) ||
  /[\\/](public_html|www|htdocs)[\\/]/i.test(envFile)
)
  throw Error("Chemin privé absolu requis pour le serveur de revue.");
const config = require("dotenv").parse(fs.readFileSync(envFile));
require("../shared/review-policy.cjs").validateReview(config);
Object.assign(process.env, config);
require("../api/dist/main.js");
