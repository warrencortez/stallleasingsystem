# Tenant mobile app

This project uses Expo SDK 57, React Native 0.86.3 and React 19.2.3. Expo Go supports password login; Google sign-in requires an installed development build because it returns through the app's custom URL scheme.

## Google sign-in on an Android phone

1. In Supabase, open **Authentication → URL Configuration** and add `leasehub://auth/callback` to **Redirect URLs**, then save. Keep the Google Cloud OAuth client's redirect URI set to the Supabase `https://bxwylyngqrddjdnucvst.supabase.co/auth/v1/callback` URL.
2. Create a free account at https://expo.dev/signup if needed. In a terminal in `mobileapp`, run `npx eas-cli@latest login`. Enter credentials in your terminal, never in chat.
3. On this Windows machine, run `powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1`. This keeps EAS temporary files and npm downloads on D: because C: is full. On other machines, run `npx eas-cli@latest build --platform android --profile development`. The project is linked to `@tealicieuxtest/leasehub-tenant`. Allow EAS to generate an Android keystore when prompted. Use the Free plan and its included build quota; no Play Store account is needed to install this APK. If the free quota is exhausted, wait for renewal instead of upgrading.
4. Open the resulting build link on the Android phone, download the APK, and install it. Android may ask you to allow installation from that browser.
5. Stop the old Expo Go development server with Ctrl+C, then run `npm run start:dev`. Keep the API running on port 5000 and keep your phone and computer on the same Wi-Fi. Open the installed **Dela Costa HOA Stall Leasing** app and scan/open the new development QR code with that app.
6. Tap **Continue with Google** and complete a fresh sign-in in the browser. Do not reuse an old OAuth URL. The browser should return to the installed app. If Google's audience is in Testing, add your Google email under Google Auth Platform → Audience → Test users.

The `development` profile in `eas.json` builds an APK containing `expo-dev-client`. It still needs Metro and the local API; this is not an offline or deployed production APK. Local `.env` supplies the Supabase public configuration when Metro starts. Do not add Google client secrets or a Supabase service-role key to the mobile app. Google sign-in does not enforce two-factor authentication by itself.

References: [Expo authentication](https://docs.expo.dev/guides/authentication/), [Android APK builds](https://docs.expo.dev/build-reference/apk/), [Free build quota](https://expo.dev/pricing).

Start from this directory with `npm start`. Scan the newly printed QR code with Expo Go while the phone and computer are on the same Wi-Fi. Keep the API server running on port 5000. Do not reuse a QR from a different Metro server.

Use Node 22.13+ (22.x), or a compatible newer LTS runtime. The launcher uses the installed runtime when supported; on the current development machine it falls back to the portable Node 22.23.3 installation on D:. `EXPO_NODE_BINARY` can override that fallback. It prefers Wi-Fi over virtual network adapters unless `REACT_NATIVE_PACKAGER_HOSTNAME` is explicitly set.

On this machine only, `node_modules` is a directory junction to `D:/stall-leasing-dev/expo57-upgrade/node_modules` because C: was full. The original SDK 54 dependencies and manifests are backed up under `D:/stall-leasing-dev/expo57-upgrade/sdk54-backup`. Keep the D-drive dependency directory available. Other machines can use a normal local `npm ci` with a compatible Node version; Metro supports both layouts. Temporary files and DevTools downloads use D: when that local tools directory exists.

The legacy splash config was migrated to the `expo-splash-screen` plugin. `index.js` registers the app directly, supporting dependency directories on another drive.

Validation after upgrade: Expo dependency check passed; Expo Doctor 21/21; mobile regression tests 9/9; Android and iOS exports passed; Android development bundle served HTTP 200. Physical phone execution still needs confirmation by scanning the fresh QR.

Upgrade reference: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/


## Cross-drive asset fix

On Windows, Metro can produce `./D:/...` asset URLs when the project is on C: and dependencies are on D:. The Metro middleware restores the absolute path only inside the dependency watch root. This fixes icon-font, navigation-image and LogBox-image downloads; it does not grant access to arbitrary files. Regression tests cover the path boundary. `qa/mobile-assets-check.cjs` downloads the actual development assets on Android and iOS (106 checks) with Metro running on port 8081.
