import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url),
  sharp = require("sharp");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "branding/exports");
const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900"><rect width="1400" height="900" fill="#f5f7fa"/><g font-family="Arial,sans-serif" fill="#193a4e"><text x="70" y="63" font-size="25" font-weight="bold">EduBest · Une seule identité</text><rect x="40" y="90" width="1320" height="180" rx="24" fill="white"/><text x="850" y="173" font-size="20">Site et application</text><text x="850" y="207" font-size="15" fill="#536b7a">Le même logo, les mêmes couleurs.</text>${[50, 500, 950].map((x) => `<rect x="${x}" y="305" width="400" height="505" rx="24" fill="white"/>`).join("")}<text x="250" y="755" text-anchor="middle" font-size="22" font-weight="bold">iOS</text><text x="250" y="785" text-anchor="middle" font-size="15" fill="#536b7a">1024 × 1024 · fond opaque</text><text x="700" y="755" text-anchor="middle" font-size="22" font-weight="bold">Android</text><text x="700" y="785" text-anchor="middle" font-size="15" fill="#536b7a">Icône adaptative</text><text x="1150" y="755" text-anchor="middle" font-size="22" font-weight="bold">Android · thème système</text><text x="1150" y="785" text-anchor="middle" font-size="15" fill="#536b7a">Calque monochrome</text><text x="700" y="860" text-anchor="middle" font-size="14" fill="#536b7a">Aperçus des masques système. Les fichiers iOS livrés sont carrés, sans coins arrondis.</text></g></svg>`;
async function masked(file, shape, adaptive = false) {
  let image = sharp(resolve(dir, file));
  if (adaptive)
    image = image.extract({ left: 180, top: 180, width: 720, height: 720 });
  const layer = await image.resize(260, 260).png().toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260">${shape}</svg>`,
  );
  return sharp({
    create: {
      width: 260,
      height: 260,
      channels: 4,
      background: adaptive ? "#193a4e" : "#ffffff",
    },
  })
    .composite([{ input: layer }, { input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}
const ios = await masked(
  "ios/edubest-app-store-1024.png",
  '<rect width="260" height="260" rx="58" fill="white"/>',
);
const android = await masked(
  "android/adaptive-foreground.png",
  '<circle cx="130" cy="130" r="130" fill="white"/>',
  true,
);
const themedRaw = await sharp(resolve(dir, "android/adaptive-monochrome.png"))
  .extract({ left: 180, top: 180, width: 720, height: 720 })
  .resize(260, 260)
  .tint("#193a4e")
  .png()
  .toBuffer();
const themed = await sharp({
  create: { width: 260, height: 260, channels: 4, background: "#193a4e" },
})
  .composite([
    { input: themedRaw },
    {
      input: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><rect width="260" height="260" rx="85" fill="white"/></svg>',
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();
await sharp(Buffer.from(text))
  .composite([
    {
      input: await sharp(
        await readFile(resolve(dir, "logo/edubest-horizontal.png")),
      )
        .resize(600, 120)
        .toBuffer(),
      left: 110,
      top: 120,
    },
    { input: ios, left: 120, top: 390 },
    { input: android, left: 570, top: 390 },
    { input: themed, left: 1020, top: 390 },
  ])
  .png()
  .toFile(resolve(root, "branding/edubest-identite-apercu.png"));
console.log("Aperçu de l’identité et des masques iOS/Android généré.");
