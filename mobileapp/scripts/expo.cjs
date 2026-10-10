const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const supported = major === 20 ? minor > 19 || (minor === 19 && patch >= 4) : major === 22 ? minor >= 13 : major === 24 ? minor >= 3 : major >= 25;
const portable = process.env.EXPO_NODE_BINARY || 'D:/stall-leasing-dev/node22/node_modules/node/bin/node.exe';
const runtime = supported ? process.execPath : fs.existsSync(portable) ? portable : null;
if (!runtime) {
    console.error('Expo SDK 57 needs Node 22.13 or newer. Update Node, or set EXPO_NODE_BINARY to a compatible node executable.');
    process.exit(1);
}
const env = { ...process.env };
const localTemp = 'D:/stall-leasing-dev/expo57-upgrade/temp';
if (fs.existsSync(path.dirname(localTemp))) {
    fs.mkdirSync(localTemp, { recursive: true });
    env.TEMP = localTemp;
    env.TMP = localTemp;
    env.DOTSLASH_CACHE ||= path.join(path.dirname(localTemp), 'dotslash-cache');
}
// Prefer Wi-Fi over virtual adapters when sharing the QR code with a phone.
const wifi = Object.entries(require('node:os').networkInterfaces()).find(([name]) => /wi-?fi|wlan|wireless/i.test(name))?.[1]?.find(address => address.family === 'IPv4' && !address.internal);
if (wifi && !env.REACT_NATIVE_PACKAGER_HOSTNAME) env.REACT_NATIVE_PACKAGER_HOSTNAME = wifi.address;
env.PATH = path.dirname(runtime) + path.delimiter + (env.PATH || '');
const args = process.argv.slice(2);
const child = spawn(runtime, [require.resolve('expo/bin/cli'), ...(args.length ? args : ['start'])], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
