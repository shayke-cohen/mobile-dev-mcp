const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Find the root of the monorepo
const rootPath = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 * 
 * For yarn workspaces, we need to include the root node_modules
 */
const config = {
  watchFolders: [rootPath],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(rootPath, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
