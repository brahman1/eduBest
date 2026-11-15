import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { compare } from "bcryptjs";
import { ServiceUnavailableException } from "@nestjs/common";

// OWASP scrypt alternative: N=2^15, r=8, p=3 (32 MiB per operation).
// Bound concurrent work rather than allowing login traffic to exhaust memory.
const prefix = "$scrypt$32768$8$3$";
let active = 0;
const waiting: Array<() => void> = [];
async function derive(value: string, salt: Buffer): Promise<Buffer> {
  if (active >= 2) {
    if (waiting.length >= 8)
      throw new ServiceUnavailableException("Connexion occupée. Réessayez.");
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        value,
        salt,
        32,
        { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      );
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
export async function hashPassword(value: string) {
  if (!value || Buffer.byteLength(value) > 512)
    throw new Error("Mot de passe invalide");
  const salt = randomBytes(16);
  const key = await derive(value, salt);
  return prefix + salt.toString("base64url") + "$" + key.toString("base64url");
}
export const needsPasswordUpgrade = (encoded: string) =>
  !encoded.startsWith(prefix);
export async function verifyPassword(value: string, encoded: string) {
  if (!value || Buffer.byteLength(value) > 512) return false;
  // Existing bcrypt hashes remain usable, without accepting silently truncated input.
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(encoded))
    return Buffer.byteLength(value) <= 72 && compare(value, encoded);
  if (!encoded.startsWith(prefix)) return false;
  const [salt, digest, extra] = encoded.slice(prefix.length).split("$");
  if (
    extra !== undefined ||
    !/^[A-Za-z0-9_-]{22}$/.test(salt ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(digest ?? "")
  )
    return false;
  const key = await derive(value, Buffer.from(salt, "base64url"));
  return timingSafeEqual(key, Buffer.from(digest, "base64url"));
}

// Fixed valid salt/digest: unknown accounts still perform the same expensive work.
export const dummyPasswordHash =
  prefix + "AAAAAAAAAAAAAAAAAAAAAA$" + Buffer.alloc(32).toString("base64url");
