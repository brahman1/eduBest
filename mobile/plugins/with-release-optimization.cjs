const { withAppBuildGradle } = require("expo/config-plugins");

// Keep the optimized Android defaults after Expo regenerates native sources.
module.exports = function withReleaseOptimization(config) {
  return withAppBuildGradle(config, (result) => {
    result.modResults.contents = result.modResults.contents.replaceAll(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    return result;
  });
};
