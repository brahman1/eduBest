import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
const dir = new URL("../.local/review-octenium/", import.meta.url);
const file = new URL("api.env", dir);
const config = dotenv.parse(await readFile(file));
if (!config.DATABASE_URL.includes("CONFIGURE_PRIVATE_PASSWORD"))
  throw Error("Configuration déjà préparée : aucun secret remplacé.");
const secret = randomBytes(24).toString("base64url");
Object.assign(config, {
  NODE_ENV: "production",
  PORT: "4200",
  TRUST_PROXY_HOPS: "1",
  WEB_URL: "https://demo.edubest.dz",
  ALLOWED_ORIGINS: "https://demo.edubest.dz",
  EDUBEST_CPANEL_ACCOUNT: "ggcsckht",
  DATABASE_URL: `postgres://ggcsckht_edubest_revapp:${encodeURIComponent(secret)}@127.0.0.1:5432/ggcsckht_edubest_review`,
});
await writeFile(
  file,
  Object.entries(config)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
await writeFile(
  new URL("CREATION-POSTGRES-PRIVEE.txt", dir),
  `NOUVEL UTILISATEUR POSTGRESQL — démonstration uniquement\n\nDans cPanel, saisir le suffixe : edubest_revapp\nUtilisateur complet : ggcsckht_edubest_revapp\nBase autorisée uniquement : ggcsckht_edubest_review\n\nMot de passe à copier dans les deux champs :\n${secret}\n\nNe pas envoyer ce fichier à Google ou le publier. Ne pas modifier ggcsckht_app.\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Profil de revue Octenium préparé en privé. Aucun identifiant affiché.",
);
