const { getDefaultConfig } = require('expo/metro-config');
const fs = require('node:fs');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
// Dependencies can live on a second drive when the system drive is full.
const installedPath = path.join(__dirname, 'node_modules');
const resolvedPath = fs.realpathSync(installedPath);
if (resolvedPath.toLowerCase() !== installedPath.toLowerCase()) {
    config.watchFolders = [...new Set([...config.watchFolders, resolvedPath])];
}
const { normalizeAssetUrl } = require('./scripts/metro-assets.cjs');
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
    const nextMiddleware = enhance ? enhance(middleware, server) : middleware;
    return (req, res, next) => {
        req.url = normalizeAssetUrl(req.url, [resolvedPath]);
        return nextMiddleware(req, res, next);
    };
};
module.exports = config;
