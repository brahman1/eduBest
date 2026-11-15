import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

const built = await build({
  entryPoints: [
    new URL("../mobile/api.ts", import.meta.url).pathname.replace(
      /^\/(\w:)/,
      "$1",
    ),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  plugins: [
    {
      name: "native-test-only",
      setup(b) {
        b.onResolve(
          { filter: /^(react-native|expo-secure-store|expo-constants)$/ },
          (a) => ({ path: a.path, namespace: "native-stub" }),
        );
        b.onLoad({ filter: /.*/, namespace: "native-stub" }, (a) => ({
          loader: "js",
          contents:
            a.path === "react-native"
              ? 'export const Platform={OS:globalThis.__nativePlatform || "android"};'
              : a.path === "expo-constants"
                ? 'export default {expoConfig:{extra:{deployment:"production"}}};'
                : 'const memory=new Map(Object.entries(globalThis.__secureValues || {})); export const WHEN_UNLOCKED_THIS_DEVICE_ONLY="private"; export async function getItemAsync(k){return memory.get(k)} export async function setItemAsync(k,v){memory.set(k,v)} export async function deleteItemAsync(k){memory.delete(k)}',
        }));
      },
    },
  ],
});
function client(fetch, env = {}, platform = "android", saved = {}) {
  const module = { exports: {} };
  vm.runInNewContext(built.outputFiles[0].text, {
    module,
    exports: module.exports,
    fetch,
    AbortController,
    URL,
    setTimeout,
    clearTimeout,
    console,
    __nativePlatform: platform,
    __secureValues: saved,
    process: {
      env: {
        EXPO_PUBLIC_API_URL: "https://api.edubest.dz/api",
        EXPO_PUBLIC_WEB_URL: "https://edubest.dz",
        ...env,
      },
    },
  });
  return module.exports;
}
const response = (status, data) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => data,
});

test("iOS : aucun accès démonstration, même avec les URL ou une ancienne session enregistrées", async () => {
  const calls = [];
  const c = client(async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization });
    return response(200, {});
  }, {
    EXPO_PUBLIC_REVIEW_API_URL: "https://demo-api.edubest.dz/api",
    EXPO_PUBLIC_REVIEW_WEB_URL: "https://demo.edubest.dz",
  }, "ios", {
    edubest_environment: "review",
    edubest_review_session: "review-only-token",
  });
  assert.equal(c.reviewAvailable, false);
  assert.equal(await c.restore(), "");
  assert.equal(c.currentEnvironment(), "school");
  await assert.rejects(() => c.selectEnvironment("review"), /Démonstration indisponible/);
  await c.api("auth/me");
  assert.equal(calls[0].url, "https://api.edubest.dz/api/auth/me");
  assert.notEqual(calls[0].authorization, "Bearer review-only-token");
});

test("Mobile : les sessions école et démonstration ne traversent jamais les environnements", async () => {
  const requests = [];
  const c = client(
    async (url, options) => {
      requests.push({ url, authorization: options.headers.Authorization });
      return response(200, {});
    },
    {
      EXPO_PUBLIC_REVIEW_API_URL: "https://demo-api.edubest.dz/api",
      EXPO_PUBLIC_REVIEW_WEB_URL: "https://demo.edubest.dz",
    },
  );
  await c.setSession("real-school-token");
  await assert.rejects(() => c.selectEnvironment("review"), /Déconnectez-vous/);
  await c.api("auth/me");
  await c.setSession("");
  await c.selectEnvironment("review");
  assert.equal(await c.restore(), "");
  await c.api("auth/login", "POST", {});
  await c.setSession("review-only-token");
  await c.api("auth/me");
  assert.equal(requests[0].url, "https://api.edubest.dz/api/auth/me");
  assert.equal(requests[0].authorization, "Bearer real-school-token");
  assert.equal(requests[1].url, "https://demo-api.edubest.dz/api/auth/login");
  assert.equal(requests[1].authorization, "Bearer mobile");
  assert.equal(requests[2].authorization, "Bearer review-only-token");
  await c.setSession("");
  await c.selectEnvironment("school");
  assert.equal(await c.restore(), "");
});

test("Mobile : une réponse de connexion en retard ne change pas la nouvelle session", async () => {
  let finish;
  const c = client(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    {
      EXPO_PUBLIC_REVIEW_API_URL: "https://demo-api.edubest.dz/api",
      EXPO_PUBLIC_REVIEW_WEB_URL: "https://demo.edubest.dz",
    },
  );
  const pending = c.api("auth/login", "POST", {});
  await c.selectEnvironment("review");
  finish(response(200, { token: "school-token" }));
  await assert.rejects(() => pending, /Environnement changé/);
  assert.equal(await c.restore(), "");
});
test("Mobile : rotation MFA conservée dans le coffre de session", async () => {
  const c = client(async () =>
    response(201, { token: "rotated", recovery_codes: ["private-code"] }),
  );
  await c.setSession("before");
  await c.api("security/mfa/enable", "POST", {});
  assert.equal(await c.restore(), "rotated");
});
test("Mobile : un mot de passe ou un facteur erroné ne déconnecte pas le compte", async () => {
  const c = client(async () => response(401, { message: "Code incorrect" }));
  await c.setSession("active");
  let expired = 0;
  c.onSessionExpired(() => expired++);
  await assert.rejects(() => c.api("security/reauthenticate", "POST", {}));
  assert.equal(await c.restore(), "active");
  assert.equal(expired, 0);
});
test("Mobile : session expirée vide le coffre et prévient l’interface", async () => {
  const c = client(async () => response(401, { message: "Session expirée" }));
  await c.setSession("expired");
  let expired = 0;
  const stop = c.onSessionExpired(() => expired++);
  await assert.rejects(() => c.api("dashboard"));
  assert.equal(await c.restore(), "");
  assert.equal(expired, 1);
  stop();
});
test("Mobile : une ancienne requête 401 ne supprime pas une session renouvelée", async () => {
  let finish;
  const c = client(() => new Promise((r) => (finish = r)));
  await c.setSession("old");
  const request = c.api("dashboard");
  await c.setSession("new");
  finish(response(401, { message: "Ancienne session" }));
  await assert.rejects(() => request);
  assert.equal(await c.restore(), "new");
});
test("Mobile : erreur réseau et réponse non JSON compréhensibles", async () => {
  let c = client(async () => {
    throw new Error("offline");
  });
  await assert.rejects(() => c.api("dashboard"), /Connexion indisponible/);
  c = client(async () => ({
    status: 502,
    ok: false,
    json: async () => {
      throw new Error("HTML");
    },
  }));
  await assert.rejects(
    () => c.api("dashboard"),
    /Réponse du serveur indisponible/,
  );
});
