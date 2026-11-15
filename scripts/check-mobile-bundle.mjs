import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
async function files(folder) {
  const out = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, item.name);
    if (item.isDirectory()) out.push(...(await files(path)));
    else if (item.name.endsWith(".map")) out.push(path);
  }
  return out;
}
function sources(map) {
  return [
    ...(map.sources ?? []),
    ...(map.sections ?? []).flatMap((section) => sources(section.map)),
  ];
}
const results = [];
for (const file of await files(resolve(root, "mobile/dist"))) {
  const list = sources(JSON.parse(await readFile(file, "utf8"))).map((path) =>
    path.replaceAll("\\", "/"),
  );
  assert.ok(list.length > 100, "Source map exploitable");
  const found = list.filter((path) =>
    /(?:^|\/)node_modules\/(?:braces|node-forge)\//.test(path),
  );
  assert.deepEqual(
    found,
    [],
    "Dépendance vulnérable présente dans le bundle : " + file,
  );
  results.push({
    file: file.slice(root.length + 1).replaceAll("\\", "/"),
    source_count: list.length,
    braces: false,
    node_forge: false,
  });
}
assert.equal(
  results.length,
  3,
  "Exporter Android, iOS et web avec --source-maps avant ce contrôle.",
);
const report = {
  date: "2026-10-21",
  bundles: results,
  note: "Absence des deux dépendances dans ces bundles JavaScript. Les avis npm restent applicables aux outils de compilation, sans correctif officiel publié. Ce contrôle ne vaut pas audit complet de l’application native.",
};
await mkdir(resolve(root, "verification"), { recursive: true });
await writeFile(
  resolve(root, "verification/mobile-bundle-scope.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
