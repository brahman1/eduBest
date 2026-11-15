import { createRequire } from "node:module";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const master = resolve(root, "branding/edubest-wordmark-v3.png");
const destination = resolve(root, "branding/exports");
const files = [];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function save(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
async function output(name, buffer) {
  await save(resolve(destination, name), buffer);
  const { width, height, channels, hasAlpha } = await sharp(buffer).metadata();
  files.push({ file: name, width, height, channels, hasAlpha });
}

// Mechanical exports from the approved EduBest. / EB. masters.
// Light assets preserve the original pixels; dark/mono variants preserve alpha.
const palette = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(resolve(root, "branding/palette.json"), "utf8"),
);
async function crop(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 64) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (right < left) throw new Error("Logo maître vide");
  left = Math.max(0, left - 5);
  top = Math.max(0, top - 5);
  return sharp(file)
    .extract({
      left,
      top,
      width: Math.min(info.width - 1, right + 5) - left + 1,
      height: Math.min(info.height - 1, bottom + 5) - top + 1,
    })
    .png()
    .toBuffer();
}
async function variant(buffer, mono = false) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const color = mono
      ? "#ffffff"
      : data[i + 2] - data[i] > 15
        ? data[i] < 145
          ? palette.accent
          : palette.action
        : palette.navy;
    data[i] = parseInt(color.slice(1, 3), 16);
    data[i + 1] = parseInt(color.slice(3, 5), 16);
    data[i + 2] = parseInt(color.slice(5, 7), 16);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
const light = await sharp(await crop(master))
  .resize(1200, 240, { fit: "contain", background: transparent })
  .png()
  .toBuffer();
const horizontal = await variant(light);
const lightBook = await crop(resolve(root, "branding/edubest-monogram-v3.png"));
const book = await variant(lightBook),
  monoBook = await variant(lightBook, true);
async function canvas(
  size,
  width,
  { opaque = false, mono = false, light = false, rgba = false } = {},
) {
  const source = mono ? monoBook : opaque || light ? lightBook : book;
  const symbol = await sharp(source)
    .resize({ width: Math.round(width) })
    .png()
    .toBuffer();
  let image = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque ? palette.navy : transparent,
    },
  }).composite([{ input: symbol, gravity: "centre" }]);
  if (opaque && !rgba)
    image = image.flatten({ background: palette.navy }).removeAlpha();
  return image.png({ palette: false }).toBuffer();
}

await output("logo/edubest-horizontal.png", horizontal);
await output("logo/edubest-horizontal-light.png", light);
await output("logo/edubest-monogram.png", await canvas(1024, 860));
await output(
  "logo/edubest-monogram-light.png",
  await canvas(1024, 860, { light: true }),
);
await output(
  "ios/edubest-app-store-1024.png",
  await canvas(1024, 730, { opaque: true }),
);
const ios = [];
for (const [idiom, pt, scale] of [
  ["iphone", 20, 2],
  ["iphone", 20, 3],
  ["iphone", 29, 2],
  ["iphone", 29, 3],
  ["iphone", 40, 2],
  ["iphone", 40, 3],
  ["iphone", 60, 2],
  ["iphone", 60, 3],
  ["ipad", 20, 1],
  ["ipad", 20, 2],
  ["ipad", 29, 1],
  ["ipad", 29, 2],
  ["ipad", 40, 1],
  ["ipad", 40, 2],
  ["ipad", 76, 1],
  ["ipad", 76, 2],
  ["ipad", 83.5, 2],
]) {
  const pixels = pt * scale,
    filename = `edubest-${idiom}-${pt}@${scale}x.png`;
  await output(
    `ios/AppIcon.appiconset/${filename}`,
    await canvas(pixels, (pixels * 730) / 1024, { opaque: true }),
  );
  ios.push({ idiom, size: `${pt}x${pt}`, scale: `${scale}x`, filename });
}
await output(
  "ios/AppIcon.appiconset/edubest-marketing.png",
  await canvas(1024, 730, { opaque: true }),
);
ios.push({
  idiom: "ios-marketing",
  size: "1024x1024",
  scale: "1x",
  filename: "edubest-marketing.png",
});
await save(
  resolve(destination, "ios/AppIcon.appiconset/Contents.json"),
  JSON.stringify(
    { images: ios, info: { version: 1, author: "xcode" } },
    null,
    2,
  ) + "\n",
);

await output(
  "android/play-store-512.png",
  await canvas(512, 365, { opaque: true, rgba: true }),
);
// 1080 px represents 108 dp at 10x. The EB. monogram fits the 66dp safe circle.
await output(
  "android/adaptive-foreground.png",
  await canvas(1080, 520, { light: true }),
);
await output(
  "android/adaptive-monochrome.png",
  await canvas(1080, 520, { mono: true }),
);
await output(
  "android/adaptive-background.png",
  await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: palette.navy,
    },
  })
    .png()
    .toBuffer(),
);
await output(
  "android/notification-96.png",
  await canvas(96, 74, { mono: true }),
);
for (const [density, size] of [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
]) {
  await output(
    `android/res/mipmap-${density}/ic_launcher.png`,
    await canvas(size, (size * 730) / 1024, { opaque: true, rgba: true }),
  );
  await output(
    `android/res/mipmap-${density}/ic_launcher_round.png`,
    await sharp(
      await canvas(size, (size * 730) / 1024, { opaque: true, rgba: true }),
    )
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer(),
  );
}
for (const name of ["ic_launcher", "ic_launcher_round"])
  await save(
    resolve(destination, `android/res/mipmap-anydpi-v26/${name}.xml`),
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@mipmap/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n',
  );
for (const name of ["ic_launcher", "ic_launcher_round"])
  await save(
    resolve(destination, `android/res/mipmap-anydpi-v33/${name}.xml`),
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@mipmap/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/><monochrome android:drawable="@mipmap/ic_launcher_monochrome"/></adaptive-icon>\n',
  );
for (const [suffix, name] of [
  ["foreground", "adaptive-foreground"],
  ["background", "adaptive-background"],
  ["monochrome", "adaptive-monochrome"],
]) {
  await mkdir(resolve(destination, "android/res/mipmap-xxxhdpi"), {
    recursive: true,
  });
  await copyFile(
    resolve(destination, `android/${name}.png`),
    resolve(
      destination,
      `android/res/mipmap-xxxhdpi/ic_launcher_${suffix}.png`,
    ),
  );
}
// Raw Android resource layers need 108dp at xxxhdpi (432px), not the 1080px master.
for (const suffix of ["foreground", "background", "monochrome"]) {
  const input = resolve(
    destination,
    `android/res/mipmap-xxxhdpi/ic_launcher_${suffix}.png`,
  );
  const resized = await sharp(input).resize(432, 432).png().toBuffer();
  await save(input, resized);
}
for (const [file, size] of [
  ["favicon-16.png", 16],
  ["favicon-32.png", 32],
  ["favicon-64.png", 64],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
])
  await output(
    `web/${file}`,
    await canvas(size, size * 0.76, { opaque: true, rgba: true }),
  );

const web = resolve(root, "web/public/brand"),
  mobile = resolve(root, "mobile/assets");
for (const folder of [web, mobile]) await mkdir(folder, { recursive: true });
for (const [file, source] of Object.entries({
  "edubest-logo.png": "logo/edubest-horizontal.png",
  "edubest-logo-light.png": "logo/edubest-horizontal-light.png",
  "edubest-mark.png": "logo/edubest-monogram.png",
  "edubest-mark-light.png": "logo/edubest-monogram-light.png",
}))
  for (const folder of [web, mobile])
    await copyFile(resolve(destination, source), resolve(folder, file));
for (const entry of files.filter((f) => f.file.startsWith("web/")))
  await copyFile(
    resolve(destination, entry.file),
    resolve(web, entry.file.slice(4)),
  );
for (const [file, source] of Object.entries({
  "icon.png": "ios/edubest-app-store-1024.png",
  "ios-icon.png": "ios/edubest-app-store-1024.png",
  "android-icon.png": "ios/edubest-app-store-1024.png",
  "adaptive.png": "android/adaptive-foreground.png",
  "android-adaptive-foreground.png": "android/adaptive-foreground.png",
  "android-adaptive-monochrome.png": "android/adaptive-monochrome.png",
  "android-adaptive-background.png": "android/adaptive-background.png",
  "notification.png": "android/notification-96.png",
  "favicon.png": "web/favicon-64.png",
  "splash.png": "logo/edubest-monogram-light.png",
}))
  await copyFile(resolve(destination, source), resolve(mobile, file));

await save(
  resolve(destination, "asset-manifest.json"),
  JSON.stringify(
    {
      source: "branding/edubest-wordmark-v3.png",
      symbolSource: "branding/edubest-monogram-v3.png",
      palette,
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${files.length} assets EduBest générés à partir du logo validé ; exports, site et mobile synchronisés.`,
);
