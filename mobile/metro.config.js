const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = fs.realpathSync(__dirname);
const workspaceRoot = path.dirname(projectRoot);
const config = getDefaultConfig(projectRoot);
config.watchFolders = [...new Set([...(config.watchFolders || []), workspaceRoot])];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === "@edubest/shared") {
    return {
      type: "sourceFile",
      filePath: fs.realpathSync(path.join(workspaceRoot, "shared/dist/index.js")),
    };
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
