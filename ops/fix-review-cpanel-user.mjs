// Only changes the planned demo DB username; preserves every existing secret.
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
const dir = new URL("../.local/review-octenium/", import.meta.url);
const file = new URL("api.env", dir);
const config = dotenv.parse(await readFile(file));
const url = new URL(config.DATABASE_URL);
if (
  url.pathname !== "/ggcsckht_edubest_review" ||
  !["ggcsckht_edubest_review", "ggcsckht_edubest_revapp"].includes(
    decodeURIComponent(url.username),
  )
)
  throw Error(
    "Profil différent de la démonstration attendue : aucune modification.",
  );
url.username = "ggcsckht_edubest_revapp";
config.DATABASE_URL = url.href;
await writeFile(
  file,
  Object.entries(config)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
const instructions = new URL("CREATION-POSTGRES-PRIVEE.txt", dir);
let text = await readFile(instructions, "utf8");
text = text
  .replace("suffixe : edubest_review", "suffixe : edubest_revapp")
  .replace(
    "Utilisateur complet : ggcsckht_edubest_review",
    "Utilisateur complet : ggcsckht_edubest_revapp",
  );
await writeFile(instructions, text, { mode: 0o600 });
console.log(
  "Nom utilisateur de revue corrigé. Base, mots de passe et clés conservés. Configuration distante non encore remplacée.",
);
