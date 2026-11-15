"use strict";
function requireRuntime(version = process.versions.node) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (major !== 22 || minor < 23 || (minor === 23 && patch < 3))
    throw Error(
      "Node 22.23.3 ou version 22 plus récente requis pour ce livrable.",
    );
}
module.exports = { requireRuntime };
