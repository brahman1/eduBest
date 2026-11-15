import { backup } from "./backup.mjs";
import { setTimeout } from "node:timers/promises";
import { randomUUID } from "node:crypto";
const seconds = Number(process.env.EDUBEST_BACKUP_INTERVAL_SECONDS ?? 86400);
if (!Number.isInteger(seconds) || seconds < 3600 || seconds > 604800)
  throw new Error("Intervalle de sauvegarde invalide.");
let stopped = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    stopped = true;
    process.exit(0);
  });
while (!stopped) {
  let delay = seconds;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await backup(
      `/backups/edubest-${stamp}-${randomUUID().slice(0, 8)}.edubest-backup`,
    );
    console.log(
      JSON.stringify({ event: "backup.success", at: new Date().toISOString() }),
    );
  } catch {
    console.error(
      JSON.stringify({ event: "backup.failure", at: new Date().toISOString() }),
    );
    delay = 3600;
  }
  await setTimeout(delay * 1000);
}
