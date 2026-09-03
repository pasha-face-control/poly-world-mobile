// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Force a SINGLE instance of three.js. Metro's package-exports resolution
// (turned ON by default since Expo SDK 55; it was OFF in SDK 54 where the
// mini-games worked) resolves `three` via BOTH its ESM (three.module.js) and
// CJS (three.cjs) entries on native -> two module instances ("Multiple
// instances of Three.js") -> @react-three/fiber's WebGL renderer draws nothing
// (blank Hunting/Fishing Canvas on device). Disabling package-exports restores
// the SDK-54 behaviour (single `main` = three.cjs) and dedupes on all platforms.
config.resolver.unstable_enablePackageExports = false;

const threeEntry = require.resolve("three");
const _origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeEntry };
  }
  return _origResolveRequest
    ? _origResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
