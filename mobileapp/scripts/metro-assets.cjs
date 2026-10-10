const path = require('node:path');

// Metro prefixes cross-drive Windows asset paths with ./, turning D:/ into
// a path relative to C:. Restore an absolute path only inside known watch roots.
function normalizeAssetUrl(requestUrl, roots) {
    const url = new URL(requestUrl, 'http://localhost');
    if (!url.pathname.startsWith('/assets/')) return requestUrl;
    const asset = url.searchParams.get('unstable_path');
    if (!asset || !/^\.\/[a-z]:[/\\]/i.test(asset)) return requestUrl;
    const [filename, ...query] = asset.slice(2).split('?');
    const absolute = path.win32.resolve(filename);
    const allowed = roots.some(root => {
        const relative = path.win32.relative(root, absolute);
        return relative !== '..' && !relative.startsWith('..\\') && !path.win32.isAbsolute(relative);
    });
    if (!allowed) return requestUrl;
    url.searchParams.set('unstable_path', absolute.replaceAll('\\', '/') + (query.length ? '?' + query.join('?') : ''));
    return url.pathname + url.search;
}
module.exports = { normalizeAssetUrl };
