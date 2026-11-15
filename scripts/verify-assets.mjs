import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exports = resolve(root, "branding/exports");
const manifest = JSON.parse(
  await readFile(resolve(exports, "asset-manifest.json"), "utf8"),
);
let checks = 0;
for (const asset of manifest.files) {
  const meta = await sharp(resolve(exports, asset.file)).metadata();
  assert.equal(meta.format, "png", asset.file);
  assert.equal(meta.width, asset.width, asset.file);
  assert.equal(meta.height, asset.height, asset.file);
  if (asset.file.startsWith("ios/")) {
    assert.equal(meta.hasAlpha, false, asset.file);
    assert.equal(meta.space, "srgb", asset.file);
  }
  checks++;
}
const ios = await sharp(
  resolve(exports, "ios/edubest-app-store-1024.png"),
).metadata();
assert.equal(ios.width, 1024);
assert.equal(ios.height, 1024);
checks++;
const play = await sharp(
  resolve(exports, "android/play-store-512.png"),
).metadata();
assert.equal(play.width, 512);
assert.equal(play.height, 512);
assert.equal(play.channels, 4);
assert.ok(
  (await readFile(resolve(exports, "android/play-store-512.png"))).length <
    1024 * 1024,
);
checks++;
const adaptive = await sharp(
  resolve(exports, "android/adaptive-foreground.png"),
)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let maxRadius = 0;
for (let y = 0; y < adaptive.info.height; y++)
  for (let x = 0; x < adaptive.info.width; x++)
    if (adaptive.data[(y * adaptive.info.width + x) * 4 + 3] > 32)
      maxRadius = Math.max(
        maxRadius,
        Math.hypot(
          x + 0.5 - adaptive.info.width / 2,
          y + 0.5 - adaptive.info.height / 2,
        ),
      );
assert.equal(adaptive.info.width, 1080);
assert.equal(adaptive.info.height, 1080);
assert.ok(maxRadius <= 330, `safe circle: ${maxRadius}`);
checks++;
for (const name of [
  "android/adaptive-monochrome.png",
  "android/notification-96.png",
]) {
  const { data, info } = await sharp(resolve(exports, name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let p = 0; p < data.length; p += 4)
    if (data[p + 3] > 16)
      assert.ok(
        data[p] >= 250 && data[p + 1] >= 250 && data[p + 2] >= 250,
        name,
      );
  if (name.includes("notification")) {
    assert.equal(info.width, 96);
    assert.equal(info.height, 96);
  }
  checks++;
}
const catalog = JSON.parse(
  await readFile(
    resolve(exports, "ios/AppIcon.appiconset/Contents.json"),
    "utf8",
  ),
);
for (const icon of catalog.images) {
  const px =
    Number(icon.size.split("x")[0]) * Number(icon.scale.replace("x", ""));
  const meta = await sharp(
    resolve(exports, "ios/AppIcon.appiconset", icon.filename),
  ).metadata();
  assert.equal(meta.width, px, icon.filename);
  assert.equal(meta.height, px, icon.filename);
  checks++;
}
for (const file of [
  "edubest-logo.png",
  "edubest-logo-light.png",
  "edubest-mark.png",
  "edubest-mark-light.png",
]) {
  assert.deepEqual(
    await readFile(resolve(root, "web/public/brand", file)),
    await readFile(resolve(root, "mobile/assets", file)),
    file,
  );
  checks++;
}
const report = {
  date: "2026-10-18",
  checks,
  pngFiles: manifest.files.length,
  ios: "1024x1024 RGB opaque + Xcode catalog",
  android:
    "512x512 RGBA Play + 1080px adaptive layers + legacy densities + white notification mask",
  adaptiveVisibleRadius: maxRadius,
  adaptiveSafeRadius: 330,
  webAndMobileLogos: "identical PNG files",
};
await mkdir(resolve(root, "verification"), { recursive: true });
await writeFile(
  resolve(root, "verification/branding-assets.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
