import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  open,
  readFile,
  appendFile,
  mkdtemp,
  rm,
  rmdir,
} from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const magic = "EDUBEST-BACKUP-1\n";
export async function backupKey(path) {
  const value = (await readFile(path, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "Clé de sauvegarde invalide : fichier hexadécimal de 32 octets requis.",
    );
  return Buffer.from(value, "hex");
}
export async function encryptDump(source, output, key) {
  const iv = randomBytes(12);
  const header = Buffer.from(
    magic +
      JSON.stringify({
        iv: iv.toString("base64url"),
        created_at: new Date().toISOString(),
        cipher: "aes-256-gcm",
      }) +
      "\n",
  );
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const target = createWriteStream(output, { flags: "wx", mode: 0o600 });
  target.write(header);
  await pipeline(source, cipher, target);
  await appendFile(output, cipher.getAuthTag());
}
// Authenticate completely before pg_restore can read a single decrypted byte.
export async function authenticatedDump(input, key) {
  const handle = await open(input, "r");
  let folder;
  try {
    const size = (await handle.stat()).size;
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const prefix = buffer.subarray(0, bytesRead);
    if (!prefix.subarray(0, magic.length).equals(Buffer.from(magic)))
      throw new Error("Format de sauvegarde invalide.");
    const end = prefix.indexOf(10, magic.length);
    if (end < 0 || size <= end + 1 + 16)
      throw new Error("Sauvegarde tronquée.");
    const metadata = JSON.parse(
      prefix.subarray(magic.length, end).toString("utf8"),
    );
    if (
      metadata.cipher !== "aes-256-gcm" ||
      !/^[A-Za-z0-9_-]{16}$/.test(metadata.iv ?? "")
    )
      throw new Error("En-tête invalide.");
    const tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, size - 16);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(metadata.iv, "base64url"),
    );
    decipher.setAAD(prefix.subarray(0, end + 1));
    decipher.setAuthTag(tag);
    folder = await mkdtemp(join(tmpdir(), "edubest-restore-"));
    const path = join(folder, "authenticated.dump");
    await pipeline(
      handle.createReadStream({
        start: end + 1,
        end: size - 17,
        autoClose: false,
      }),
      decipher,
      createWriteStream(path, { flags: "wx", mode: 0o600 }),
    );
    return {
      path,
      metadata,
      async dispose() {
        await rm(path, { force: true });
        await rmdir(folder);
      },
    };
  } catch (error) {
    if (folder) {
      await rm(join(folder, "authenticated.dump"), { force: true });
      await rmdir(folder);
    }
    throw error;
  } finally {
    await handle.close();
  }
}
