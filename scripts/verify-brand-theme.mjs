import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const palette = JSON.parse(
  await readFile(resolve(root, "branding/palette.json"), "utf8"),
);
assert.deepEqual(
  JSON.parse(await readFile(resolve(root, "mobile/brand-config.json"), "utf8")),
  palette,
);
const css = await readFile(resolve(root, "web/app/brand-tokens.css"), "utf8");
for (const [key, value] of Object.entries(palette))
  assert.ok(
    css.includes(
      `--brand-${key.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase())}: ${value}`,
    ),
  );
function luminance(hex) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const pairs = [
  ["ink", "surface"],
  ["ink", "paper"],
  ["muted", "surface"],
  ["muted", "paper"],
  ["subtle", "paper"],
  ["surface", "action"],
  ["surface", "navy"],
  ["sidebarText", "navy"],
  ["sidebarMuted", "navy"],
  ["action", "soft"],
  ["success", "successBg"],
  ["danger", "dangerBg"],
  ["warning", "warningBg"],
];
const contrast = pairs.map(([text, background]) => {
  const a = luminance(palette[text]),
    b = luminance(palette[background]),
    ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 4.5, `${text}/${background}: ${ratio}`);
  return { text, background, ratio: Math.round(ratio * 100) / 100 };
});
await mkdir(resolve(root, "verification"), { recursive: true });
await writeFile(
  resolve(root, "verification/brand-theme.json"),
  JSON.stringify(
    {
      identity: "EduBest. / EB.",
      palette,
      contrast,
      note: "Contrastes des couples de couleurs principaux ; ne constitue pas un audit complet de toutes les pages.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Palette web/mobile identique ; ${contrast.length} couples de texte avec contraste >= 4.5:1.`,
);
