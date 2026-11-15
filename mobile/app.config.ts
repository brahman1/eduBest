import { ExpoConfig } from "expo/config";
import palette from "./brand-config.json";
import iosBuildSettings from "./ios-build-settings.json";
const internalTest = process.env.EDUBEST_INTERNAL_BUILD === "true";
const iosCaptures = process.env.EAS_BUILD_PROFILE === "ios-captures";
if (iosCaptures && process.env.EAS_BUILD_PLATFORM === "android")
  throw new Error("Le profil de captures est réservé au simulateur iOS.");
// A local, signed Android release can use the school API without an Expo push project.
const localRelease =
  process.env.EDUBEST_LOCAL_RELEASE === "true" &&
  process.env.EAS_BUILD !== "true";
const production =
  process.env.EDUBEST_RELEASE === "true" ||
  ["production", "production-apk", "ios-production", "ios-simulator", "ios-captures"].includes(
    process.env.EAS_BUILD_PROFILE ?? "",
  );
const preparingIos = process.env.EDUBEST_IOS_PREPARE === "true";
if (preparingIos && process.env.EAS_BUILD === "true")
  throw new Error("Le mode de préparation local est interdit dans EAS Build.");
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || iosBuildSettings.easProjectId || undefined;
const appleTeamId = process.env.EDUBEST_APPLE_TEAM_ID || iosBuildSettings.appleTeamId || undefined;
if (appleTeamId && !/^[A-Z0-9]{10}$/.test(appleTeamId))
  throw new Error("Identifiant d’équipe Apple invalide.");
function validPublicUrl(value: string | undefined) {
  try {
    const u = new URL(value ?? "");
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      !u.port &&
      u.hostname.includes(".") &&
      !u.hostname.startsWith("[") &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) &&
      !/(^|\.)(local|localhost|test|example|invalid)$/.test(u.hostname) &&
      !/(^|\.)example\.(com|net|org)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
if (
  (process.env.EXPO_PUBLIC_REVIEW_API_URL ||
    process.env.EXPO_PUBLIC_REVIEW_WEB_URL) &&
  (!validPublicUrl(process.env.EXPO_PUBLIC_REVIEW_API_URL) ||
    !validPublicUrl(process.env.EXPO_PUBLIC_REVIEW_WEB_URL) ||
    new URL(process.env.EXPO_PUBLIC_REVIEW_API_URL!).pathname !== "/api" ||
    new URL(process.env.EXPO_PUBLIC_REVIEW_WEB_URL!).pathname !== "/" ||
    new URL(process.env.EXPO_PUBLIC_REVIEW_API_URL!).origin ===
      new URL(process.env.EXPO_PUBLIC_API_URL!).origin ||
    new URL(process.env.EXPO_PUBLIC_REVIEW_WEB_URL!).origin ===
      new URL(process.env.EXPO_PUBLIC_WEB_URL!).origin)
)
  throw new Error(
    "Revue Android refusée : deux origines HTTPS distinctes de l’école sont requises.",
  );
if (
  production &&
  ((!internalTest && !localRelease && !preparingIos && !projectId) ||
    (!!projectId &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        projectId,
      )) ||
    !validPublicUrl(process.env.EXPO_PUBLIC_API_URL) ||
    !validPublicUrl(process.env.EXPO_PUBLIC_WEB_URL) ||
    new URL(process.env.EXPO_PUBLIC_API_URL!).pathname !== "/api" ||
    new URL(process.env.EXPO_PUBLIC_WEB_URL!).pathname !== "/")
)
  throw new Error(
    "Publication refusée : définir EXPO_PUBLIC_EAS_PROJECT_ID, EXPO_PUBLIC_API_URL (HTTPS /api) et EXPO_PUBLIC_WEB_URL (origine HTTPS) avec des adresses réelles.",
  );
const config: ExpoConfig = {
  name: iosCaptures ? "EduBest Captures" : internalTest ? "EduBest Essai" : "EduBest",
  slug: "edubest",
  version: "1.1.4",
  orientation: "portrait",
  scheme: iosCaptures ? "edubest-captures" : internalTest ? "edubest-preview" : "edubest",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    icon: "./assets/ios-icon.png",
    supportsTablet: true,
    buildNumber: "1",
    ...(appleTeamId ? { appleTeamId } : {}),
    bundleIdentifier: iosCaptures ? "dz.edubest.captures" : internalTest ? "dz.edubest.preview" : "dz.edubest.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(!production
        ? {
            NSLocalNetworkUsageDescription:
              "Connexion au serveur EduBest local lors des tests.",
            NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
          }
        : {}),
    },
  },
  android: {
    allowBackup: false,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    icon: "./assets/android-icon.png",
    package: internalTest ? "dz.edubest.preview" : "dz.edubest.app",
    adaptiveIcon: {
      foregroundImage: "./assets/android-adaptive-foreground.png",
      backgroundImage: "./assets/android-adaptive-background.png",
      backgroundColor: palette.navy,
      monochromeImage: "./assets/android-adaptive-monochrome.png",
    },
    permissions: ["POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: !production,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    "./plugins/with-release-optimization.cjs",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 160,
        backgroundColor: palette.navy,
      },
    ],
    "expo-secure-store",
    [
      "expo-notifications",
      { icon: "./assets/notification.png", color: palette.navy },
    ],
    "expo-document-picker",
    "expo-sharing",
  ],
  extra: {
    deployment: production ? "production" : "development",
    internalTest,
    ...(iosCaptures ? { screenshotOnly: true } : {}),
    ...(projectId ? { eas: { projectId } } : {}),
  },
};
export default config;
