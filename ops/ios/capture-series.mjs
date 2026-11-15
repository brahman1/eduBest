#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const helper = path.join(root, "ops/ios/mac.mjs");
const ipad = process.argv.includes("--ipad");
const family = ipad ? "ipad" : "iphone";
const screens = [
  ["01-connexion", "Déconnectez-vous et affichez la connexion, sans clavier ni mot de passe."],
  ["02-inscription", "Affichez la demande d’inscription, puis les champs de niveau scolaire."],
  ["03-espace-eleve", "Connectez le compte élève fictif et affichez son tableau de bord."],
  ["04-planning-eleve", "Affichez le planning personnel de cet élève."],
  ["05-espace-parent", "Connectez le compte parent fictif et affichez le suivi de ses enfants."],
  ["06-planning-enseignant", "Connectez le compte enseignant fictif et affichez son planning."],
  ["07-documents", "Affichez les documents ou annonces fictifs utiles aux familles."],
];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Commande interrompue. Vérifiez le message affiché.");
}

try {
  if (process.platform !== "darwin")
    throw new Error("La prise de captures nécessite le Mac avec Xcode.");
  const destination = path.join(root, "store/app-store/screenshots", family);
  for (const [name] of screens)
    if (fs.existsSync(path.join(destination, name + ".png")))
      throw new Error("Une série existe déjà. Conservez-la dans un autre dossier avant de recommencer.");
  run(process.execPath, [helper, "simulator", "--captures", ...(ipad ? ["--ipad"] : [])]);
  for (const [name, instruction] of screens) {
    console.log("\n" + name + "\n" + instruction);
    if (name === "02-inscription") {
      console.log("Le serveur isolé peut désactiver les inscriptions. Capturez uniquement un écran accessible.");
      const reader = createInterface({ input: process.stdin, output: process.stdout });
      const skip = await reader.question("Tapez PASSER si ce formulaire est indisponible, ou Entrée pour continuer. ");
      reader.close();
      if (skip === "PASSER") continue;
    }
    run(process.execPath, [helper, "capture", "--name", name, ...(ipad ? ["--ipad"] : [])]);
  }
  const files = fs.readdirSync(destination).filter((name) => name.endsWith(".png"));
  if (files.length < 6) throw new Error("La série contient moins de six captures.");
  for (const name of files) {
    const report = JSON.parse(fs.readFileSync(path.join(destination, name + ".json"), "utf8"));
    if (!report.nativeSimulatorCapture || !report.validSize)
      throw new Error("Capture non validée : " + name);
  }
  const release = path.join(root, "release");
  fs.mkdirSync(release, { recursive: true });
  const zip = path.join(release, "EduBest-App-Store-Captures-" + family + "-" + Date.now() + ".zip");
  run("ditto", ["-c", "-k", "--keepParent", destination, zip]);
  console.log("\nArchive créée pour vérification visuelle avant App Store Connect\n" + zip);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
