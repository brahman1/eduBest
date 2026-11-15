import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import {
  hashPassword,
  verifyPassword,
  needsPasswordUpgrade,
  dummyPasswordHash,
} from "../api/dist/passwords.js";
import { password } from "../shared/dist/index.js";

test("Mots de passe : scrypt salé, phrases Unicode longues et absence de troncature", async () => {
  const value = "مدرستي جميلة ومليئة بالمعرفة والنجاح كل يوم";
  assert.ok(Buffer.byteLength(value) > 72);
  assert.ok(password.safeParse(value).success);
  const first = await hashPassword(value),
    second = await hashPassword(value);
  assert.notEqual(first, second);
  assert.equal(needsPasswordUpgrade(first), false);
  assert.equal(await verifyPassword(value, first), true);
  assert.equal(await verifyPassword(value + "!", first), false);
  assert.equal(await verifyPassword("incorrect", dummyPasswordHash), false);
  for (const malformed of [
    "",
    "$scrypt$999999999$8$3$x$y",
    first + "$extra",
    "$scrypt$32768$8$3$x$x",
  ])
    assert.equal(await verifyPassword(value, malformed), false);
});
test("Mots de passe : bcrypt existant accepté, suffixes tronqués refusés", async () => {
  const value = "x".repeat(72),
    encoded = await hash(value, 12);
  assert.equal(await verifyPassword(value, encoded), true);
  assert.equal(await verifyPassword(value + "attacker", encoded), false);
  assert.equal(needsPasswordUpgrade(encoded), true);
});
test("Phrases de passe : minimum, mots trop courants, limite et espaces", () => {
  for (const bad of [
    "Password123!",
    "Password123456789!",
    "EduBest202620262026!",
    "a".repeat(20),
    "long unique password ".repeat(10),
  ])
    assert.equal(password.safeParse(bad).success, false);
  assert.equal(
    password.safeParse("une longue phrase pour mon école").success,
    true,
  );
});
