import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "127.0.0.1";
const production = Constants.expoConfig?.extra?.deployment === "production";
if (
  production &&
  (!process.env.EXPO_PUBLIC_API_URL?.startsWith("https://") ||
    !process.env.EXPO_PUBLIC_WEB_URL?.startsWith("https://"))
)
  throw new Error("Configuration de publication EduBest absente.");
const schoolBase = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:4200/api`;
const schoolWebsite = process.env.EXPO_PUBLIC_WEB_URL ?? `http://${host}:3100`;
const reviewBase = process.env.EXPO_PUBLIC_REVIEW_API_URL ?? "";
const reviewWebsite = process.env.EXPO_PUBLIC_REVIEW_WEB_URL ?? "";
export const reviewAvailable = (() => {
  // iOS ships only the school's normal login, even if old review URLs are set.
  if (Platform.OS === "ios") return false;
  try {
    const api = new URL(reviewBase),
      web = new URL(reviewWebsite);
    return (
      api.protocol === "https:" &&
      web.protocol === "https:" &&
      api.pathname === "/api" &&
      web.pathname === "/" &&
      !api.username &&
      !api.password &&
      !api.search &&
      !api.hash &&
      !web.username &&
      !web.password &&
      !web.search &&
      !web.hash &&
      api.origin !== new URL(schoolBase).origin &&
      web.origin !== new URL(schoolWebsite).origin
    );
  } catch {
    return false;
  }
})();
export type Environment = "school" | "review";
let environment: Environment = "school";
let generation = 0;
export let BASE = schoolBase;
export let WEBSITE = schoolWebsite;
export const currentEnvironment = () => environment;
const sessionKey = () =>
  environment === "review" ? "edubest_review_session" : "edubest_session";
async function saveValue(key: string, value: string) {
  if (Platform.OS === "web") {
    value ? sessionStorage.setItem(key, value) : sessionStorage.removeItem(key);
  } else if (value)
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync(key);
}
async function readValue(key: string) {
  return Platform.OS === "web"
    ? sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
export async function selectEnvironment(value: Environment) {
  if (value !== "school" && value !== "review")
    throw new Error("Environnement invalide.");
  if (value === "review" && !reviewAvailable)
    throw new Error("Démonstration indisponible.");
  if (session)
    throw new Error("Déconnectez-vous avant de changer d’environnement.");
  generation++;
  environment = value;
  BASE = value === "review" ? reviewBase : schoolBase;
  WEBSITE = value === "review" ? reviewWebsite : schoolWebsite;
  await saveValue("edubest_environment", value);
  // Never restore credentials from the other environment when switching manually.
  await saveValue(sessionKey(), "");
}
let session = "";
const expiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}
export async function restore() {
  const saved = await readValue("edubest_environment");
  environment = saved === "review" && reviewAvailable ? "review" : "school";
  BASE = environment === "review" ? reviewBase : schoolBase;
  WEBSITE = environment === "review" ? reviewWebsite : schoolWebsite;
  session =
    Platform.OS === "web"
      ? (sessionStorage.getItem(sessionKey()) ?? "")
      : ((await SecureStore.getItemAsync(sessionKey())) ?? "");
  return session;
}
export async function setSession(value: string) {
  session = value;
  await saveValue(sessionKey(), value);
}
export async function raw(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${BASE}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session || "mobile"}`,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const requestedSession = session;
  const requestedGeneration = generation;
  let r: Response;
  try {
    r = await raw(path, method, body, key);
  } catch {
    throw new Error(
      "Connexion indisponible. Vérifiez votre réseau et réessayez. / الاتصال غير متاح. تحقق من الشبكة.",
    );
  }
  const data = await r.json().catch(() => ({
    message:
      "Réponse du serveur indisponible. Réessayez. / استجابة الخادم غير متاحة. أعد المحاولة.",
  }));
  if (requestedGeneration !== generation)
    throw new Error("Environnement changé. Recommencez la connexion.");
  if (!r.ok) {
    if (
      r.status === 401 &&
      requestedSession &&
      requestedSession === session &&
      ![
        "auth/login",
        "auth/password",
        "privacy/requests",
        "privacy/account",
      ].includes(path) &&
      !(path.startsWith("security/") && method !== "GET")
    ) {
      await setSession("");
      expiredListeners.forEach((listener) => listener());
      throw new Error("Session expirée. Reconnectez-vous. / انتهت الجلسة.");
    }
    throw new Error(data.message ?? "Erreur / خطأ");
  }
  if (
    ["auth/password", "security/mfa/enable", "security/mfa/disable"].includes(
      path,
    ) &&
    typeof data.token === "string"
  )
    await setSession(data.token);
  return data;
}
export function centimes(v: string) {
  const s = v.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Montant invalide / مبلغ غير صالح");
  const [w, f = ""] = s.split(".");
  const n = Number(w) * 100 + Number(f.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 100_000_000_000)
    throw new Error("Montant invalide / مبلغ غير صالح");
  return n;
}
