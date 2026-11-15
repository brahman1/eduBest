import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const file = resolve(root, ".local/servers.json");
try {
  const data = JSON.parse(await readFile(file, "utf8"));
  if (data.root !== root) throw new Error("Fichier de processus étranger.");
  for (const entry of data.processes) {
    if (
      !Number.isInteger(entry.pid) ||
      (!entry.script.startsWith(root + "\\") &&
        !entry.script.startsWith(root + "/"))
    )
      throw new Error("Processus non valide.");
    if (process.platform === "win32") {
      const code = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${entry.pid}'; if ($p -and $p.CommandLine.Contains('${entry.script.replaceAll("'", "''")}')) { Stop-Process -Id ${entry.pid} }`;
      execFileSync("powershell.exe", ["-NoProfile", "-Command", code], {
        windowsHide: true,
      });
    } else {
      const command = execFileSync(
        "ps",
        ["-p", String(entry.pid), "-o", "args="],
        { encoding: "utf8" },
      );
      if (command.includes(entry.script)) process.kill(entry.pid, "SIGTERM");
    }
  }
  await rm(file, { force: true });
  console.log("Serveurs EduBest arrêtés. Base conservée.");
} catch (e) {
  if (e.code === "ENOENT") console.log("Aucun serveur EduBest enregistré.");
  else {
    console.error("Arrêt refusé : " + e.message);
    process.exitCode = 1;
  }
}
