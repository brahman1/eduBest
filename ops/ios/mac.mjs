#!/usr/bin/env node
// Development tools only: no passwords, no automatic App Store submission.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mobile = path.join(root, "mobile");
const local = path.join(root, ".local/ios");
const action = process.argv[2] || "help";
const args = process.argv.slice(3);
const has = (name) => args.includes(name);
const value = (name) => args[args.indexOf(name) + 1];
fs.mkdirSync(local, { recursive: true });

function run(command, argv = [], options = {}) {
  const result = spawnSync(command, argv, {
    cwd: root, env: process.env, stdio: "inherit", ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} a échoué (code ${result.status}).`);
  return result.stdout?.toString().trim() || "";
}
function output(command, argv, options = {}) {
  return run(command, argv, { stdio: ["inherit", "pipe", "inherit"], ...options });
}
function macOnly() {
  if (os.platform() !== "darwin") throw new Error("Cette action nécessite le Mac et Xcode.");
}
function settingsRequired() {
  const s = JSON.parse(fs.readFileSync(path.join(mobile, "ios-build-settings.json"), "utf8"));
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s.easProjectId || ""))
    throw new Error("Renseigner le vrai Project ID Expo avec l’action configure.");
  return s;
}
function buildEnv(capture = false, preparing = true) {
  const env = { ...process.env,
    EDUBEST_RELEASE: "true", EAS_BUILD_PLATFORM: "ios",
    EAS_BUILD_PROFILE: capture ? "ios-captures" : "ios-production",
    EXPO_PUBLIC_API_URL: capture ? "https://demo-api.edubest.dz/api" : "https://api.edubest.dz/api",
    EXPO_PUBLIC_WEB_URL: capture ? "https://demo.edubest.dz" : "https://edubest.dz",
    EXPO_PUBLIC_REVIEW_API_URL: "", EXPO_PUBLIC_REVIEW_WEB_URL: "",
    EDUBEST_INTERNAL_BUILD: "false", EDUBEST_IOS_PREPARE: preparing ? "true" : "false", NODE_ENV: "production",
  };
  if (preparing) delete env.EAS_BUILD;
  return env;
}
function doctor() {
  macOnly();
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Installer Node.js 22 ou plus récent.");
  const version = output("xcodebuild", ["-version"]);
  console.log(version);
  const major = Number(/Xcode (\d+)/.exec(version)?.[1]);
  if (major < 26) throw new Error("Xcode 26 ou plus récent requis pour la soumission Apple actuelle.");
  console.log(output("xcrun", ["--sdk", "iphoneos", "--show-sdk-version"]));
  console.log("CocoaPods:", output("pod", ["--version"]));
  const runtime = JSON.parse(output("xcrun", ["simctl", "list", "runtimes", "-j"]));
  if (!runtime.runtimes.some((r) => r.isAvailable && r.identifier.includes(".iOS-")))
    throw new Error("Installer un runtime iOS dans Xcode > Settings > Components.");
  console.log("Mac prêt pour la préparation locale. Aucun accord Apple accepté automatiquement.");
}
function workspace() {
  const dir = path.join(mobile, "ios");
  const files = fs.readdirSync(dir).filter((n) => n.endsWith(".xcworkspace") && n !== "Pods.xcworkspace");
  if (files.length !== 1) throw new Error("Un seul workspace Xcode EduBest est attendu.");
  const file = path.join(dir, files[0]);
  const listing = JSON.parse(output("xcodebuild", ["-list", "-json", "-workspace", file]));
  const schemes = listing.workspace?.schemes || [];
  const scheme = schemes.find((n) => /^EduBest/i.test(n));
  if (!scheme) throw new Error("Schéma Xcode EduBest introuvable.");
  return { file, scheme };
}
function findSimulator(kind) {
  const store = path.join(local, `simulator-${kind}.json`);
  const all = JSON.parse(output("xcrun", ["simctl", "list", "devices", "available", "-j"]));
  if (fs.existsSync(store)) {
    const saved = JSON.parse(fs.readFileSync(store, "utf8"));
    if (Object.values(all.devices).flat().some((d) => d.udid === saved.udid && d.isAvailable)) return saved;
  }
  const types = JSON.parse(output("xcrun", ["simctl", "list", "devicetypes", "-j"])).devicetypes;
  const type = kind === "ipad"
    ? types.find((t) => /iPad Pro.*13-inch.*M4/.test(t.name)) || types.find((t) => /iPad Pro.*13-inch/.test(t.name))
    : types.find((t) => t.name === "iPhone 16 Pro Max") || types.find((t) => /iPhone.*Pro Max/.test(t.name));
  if (!type) throw new Error("Installer les types de simulateurs iPhone Pro Max et iPad Pro 13 pouces dans Xcode.");
  const runtimes = JSON.parse(output("xcrun", ["simctl", "list", "runtimes", "-j"])).runtimes
    .filter((r) => r.isAvailable && r.identifier.includes(".iOS-"))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  const udid = output("xcrun", ["simctl", "create", `EduBest-Captures-${kind}`, type.identifier, runtimes[0].identifier]);
  if (!/^[A-F0-9-]{36}$/i.test(udid)) throw new Error("UDID du simulateur inattendu.");
  const saved = { udid, kind, deviceType: type.name, ownedByThisKit: true };
  fs.writeFileSync(store, JSON.stringify(saved, null, 2));
  return saved;
}
function boot(sim) {
  const all = JSON.parse(output("xcrun", ["simctl", "list", "devices", "available", "-j"]));
  const device = Object.values(all.devices).flat().find((d) => d.udid === sim.udid);
  if (device?.state !== "Booted") run("xcrun", ["simctl", "boot", sim.udid]);
  run("xcrun", ["simctl", "bootstatus", sim.udid, "-b"]);
  run("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", sim.udid]);
}

try {
  if (action === "doctor") doctor();
  else if (action === "configure") {
    const project = value("--expo-project"), team = value("--apple-team");
    if (!has("--expo-project") || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(project || ""))
      throw new Error("Utiliser --expo-project suivi du vrai UUID Expo.");
    if (has("--apple-team") && !/^[A-Z0-9]{10}$/.test(team || "")) throw new Error("Team ID Apple invalide.");
    fs.writeFileSync(path.join(mobile, "ios-build-settings.json"), JSON.stringify({ easProjectId: project, appleTeamId: has("--apple-team") ? team : null }, null, 2) + "\n");
    console.log("Identifiants publics enregistrés. Aucun mot de passe demandé ni enregistré.");
  } else if (action === "simulator") {
    doctor();
    const capture = has("--captures");
    const kind = has("--ipad") ? "ipad" : "iphone";
    const env = buildEnv(capture);
    run("npm", ["run", "build", "-w", "shared"]);
    run("node", [path.join(root, "node_modules/expo/bin/cli"), "prebuild", "--platform", "ios", "--no-install"], { cwd: mobile, env });
    run("pod", ["install"], { cwd: path.join(mobile, "ios"), env });
    const { file, scheme } = workspace();
    const derived = path.join(local, capture ? "derived-captures" : "derived-production");
    run("xcodebuild", ["-workspace", file, "-scheme", scheme, "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", derived, "CODE_SIGNING_ALLOWED=NO", "build"], { env });
    const apps = fs.readdirSync(path.join(derived, "Build/Products/Release-iphonesimulator")).filter((n) => n.endsWith(".app"));
    if (apps.length !== 1) throw new Error("Application simulateur introuvable ou ambiguë.");
    const app = path.join(derived, "Build/Products/Release-iphonesimulator", apps[0]);
    const sim = findSimulator(kind);
    boot(sim);
    run("xcrun", ["simctl", "install", sim.udid, app]);
    run("xcrun", ["simctl", "launch", sim.udid, capture ? "dz.edubest.captures" : "dz.edubest.app"]);
    fs.writeFileSync(path.join(local, `last-${kind}.json`), JSON.stringify({ ...sim, capture, profile: env.EAS_BUILD_PROFILE, app }, null, 2));
    console.log(capture ? "Application de captures : données fictives, sans sélecteur de démonstration. Ne pas soumettre cette variante." : "Application de production : connexion à l’école réelle. Ne pas utiliser les comptes de démonstration ici.");
  } else if (action === "capture") {
    macOnly();
    const kind = has("--ipad") ? "ipad" : "iphone";
    const sim = JSON.parse(fs.readFileSync(path.join(local, `last-${kind}.json`), "utf8"));
    if (!sim.capture) throw new Error("Captures publiques interdites sur les dossiers réels : démarrer simulator --captures.");
    const name = value("--name");
    if (!has("--name") || !/^[a-z0-9-]+$/.test(name || "")) throw new Error("Utiliser --name suivi d’un nom simple, par exemple 02-planning.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Afficher le bon écran sans mot de passe ni clavier. Confirmer DONNEES FICTIVES pour enregistrer : ");
    rl.close();
    if (answer !== "DONNEES FICTIVES") throw new Error("Capture annulée.");
    const dir = path.join(root, "store/app-store/screenshots", kind);
    fs.mkdirSync(dir, { recursive: true });
    const png = path.join(dir, `${name}.png`);
    if (fs.existsSync(png)) throw new Error("Capture existante : choisir un nouveau nom.");
    run("xcrun", ["simctl", "io", sim.udid, "screenshot", "--type=png", png]);
    const bytes = fs.readFileSync(png);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    const sizes = kind === "ipad" ? [[2064,2752],[2048,2732]] : [[1320,2868],[1290,2796],[1260,2736],[1284,2778],[1242,2688]];
    const validSize = sizes.some(([w,h]) => w === width && h === height);
    fs.writeFileSync(png + ".json", JSON.stringify({ nativeSimulatorCapture: true, screenshotOnlyBuild: true, width, height, validSize, deviceType: sim.deviceType, capturedAt: new Date().toISOString() }, null, 2));
    console.log(png, `${width} x ${height}`, validSize ? "Dimensions acceptées." : "Dimensions à vérifier avant App Store Connect.");
    if (!validSize) process.exitCode = 2;
  } else if (action === "archive") {
    doctor(); settingsRequired();
    const env = buildEnv(false, false);
    run("npm", ["run", "build", "-w", "shared"]);
    const release = path.join(root, "release"); fs.mkdirSync(release, { recursive: true });
    const ipa = path.join(release, `EduBest-iOS-${Date.now()}.ipa`);
    run("eas", ["build", "--platform", "ios", "--profile", "ios-production", "--local", "--output", ipa], { cwd: mobile, env });
    console.log("IPA généré :", ipa, "Tester dans TestFlight avant toute soumission.");
  } else if (action === "help") {
    console.log("EduBest iOS\nActions : doctor | configure --expo-project UUID [--apple-team TEAMID] | simulator [--captures] [--ipad] | capture --name NOM [--ipad] | archive\nAucune soumission ni publication automatique. Documentation : store/app-store/LISEZ-MOI.md");
  } else throw new Error("Action inconnue.");
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
