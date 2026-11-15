"use strict";
const path = require("node:path");
process.env.EDUBEST_ENV_FILE ||= path.resolve(
  __dirname,
  "../../private/api.env",
);
require(
  path.resolve(__dirname, "../../runtime/api/ops/octenium/api-entry.cjs"),
);
