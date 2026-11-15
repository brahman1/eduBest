import { spawn } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import dotenv from "dotenv";
const root = resolve(import.meta.dirname, "..");
process.chdir(root);
mkdirSync(".local", { recursive: true });
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    readFileSync(".env.example", "utf8").replace(
      "SECURITY_ENCRYPTION_KEY=",
      "SECURITY_ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
    ),
  );
dotenv.config({ path: resolve(root, ".env"), quiet: true });
const webPort = Number(process.env.EDUBEST_WEB_PORT ?? 3100);
if (!Number.isInteger(webPort) || webPort < 1024 || webPort > 65535)
  throw new Error("Port web local invalide.");
const children = new Set();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
let stopping = false;
function run(command, args, options = {}) {
  const proc = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32" && command === npm,
    windowsHide: true,
    ...options,
  });
  children.add(proc);
  return new Promise((accept, reject) => {
    proc.once("error", reject);
    proc.once("exit", (code) => {
      children.delete(proc);
      code === 0 || stopping
        ? accept()
        : reject(new Error("Processus arrêté : " + command));
    });
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  rmSync(resolve(root, ".local/servers.json"), { force: true });
  process.exitCode = code;
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => stop());
async function available(port) {
  await new Promise((accept, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} déjà utilisé : aucun autre service n’a été arrêté.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(accept));
  });
}
try {
  await available(4200);
  await available(webPort);
  if (
    process.platform === "win32" &&
    existsSync(resolve(root, ".local/postgres/PG_VERSION"))
  )
    await run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(root, "ops/start-native.ps1"),
    ]);
  else {
    try {
      await run("docker", [
        "compose",
        "-p",
        "edubest",
        "-f",
        "ops/compose.local.yml",
        "up",
        "-d",
        "--wait",
      ]);
    } catch (error) {
      if (process.platform !== "win32") throw error;
      console.log(
        "Docker indisponible : tentative avec PostgreSQL 17 déjà installé.",
      );
      await run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        resolve(root, "ops/start-native.ps1"),
      ]);
    }
  }
  if (
    !existsSync("api/dist/main.js") ||
    !existsSync("web/.next/standalone/web/server.js") ||
    process.argv.includes("--rebuild")
  )
    await run(npm, ["run", "build"]);
  await run(process.execPath, [resolve(root, "api/dist/migrate.js")], {
    cwd: resolve(root, "api"),
  });
  if (process.env.EDUBEST_DEMO_ENABLED === "true")
    await run(npm, ["run", "demo"]);
  else
    await run(process.execPath, [
      resolve(root, "scripts/setup-school.mjs"),
      "--if-empty",
    ]);
  const api = spawn(process.execPath, [resolve(root, "api/dist/main.js")], {
    cwd: resolve(root, "api"),
    env: { ...process.env, NODE_ENV: "development", PORT: "4200" },
    stdio: "inherit",
    windowsHide: true,
  });
  children.add(api);
  api.once("exit", (code) => {
    children.delete(api);
    if (!stopping) stop(code || 1);
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:4200/api/public/health")).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!ready) throw new Error("API locale indisponible.");
  const web = spawn(
    process.execPath,
    [resolve(root, "scripts/serve-web.mjs")],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  children.add(web);
  web.once("exit", (code) => {
    children.delete(web);
    if (!stopping) stop(code || 1);
  });
  writeFileSync(
    resolve(root, ".local/servers.json"),
    JSON.stringify(
      {
        root,
        processes: [
          { pid: api.pid, script: resolve(root, "api/dist/main.js") },
          { pid: web.pid, script: resolve(root, "scripts/serve-web.mjs") },
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    `\nEduBest : http://127.0.0.1:${webPort} — les données de démonstration restent séparées de Midad. Ctrl+C pour arrêter.\n`,
  );
} catch (e) {
  console.error(e.message);
  stop(1);
}
