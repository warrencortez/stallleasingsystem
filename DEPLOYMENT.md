# Free deployment and Google sign-in

For the community partner deployment using Netlify Free and live QR Ph, follow [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md). The Vercel instructions below remain an alternative; Vercel Hobby is not the target for actual rent collection.

The repository is prepared for two Vercel projects: `webapp` (Vite website) and `server` (Express API). No paid service is required for a personal/school demo within the free quotas. No cloud account, deployment, Google provider or scheduler is created just by editing these files.

Vercel Hobby is restricted to personal, non-commercial use. Confirm that this is a school/personal demo before using Hobby; actual commercial rent collection requires a suitable hosting plan/provider. Do not upgrade to Pro or enable paid add-ons for this project. PayMongo test mode is free of real transactions; real payments incur processing fees. Supabase and Vercel free quotas are finite, and Supabase free projects may pause after inactivity. This setup does not promise unlimited or always-on service.

## 1. Supabase database and private storage

Use the existing Supabase project, on its Free plan. In **Connect**, select the **transaction pooler** and copy its host, port (usually 6543), database, username and password into the API's environment variables. The backend uses PostgreSQL directly, not the public Data API. Keep `DEMO_MODE=false`; the in-memory demo store loses records between requests on serverless hosting.

Back up your database before migrations. From `server`, run against the chosen database:

```powershell
node scripts/migrate-daily-cash.cjs
node scripts/migrate-recurring.cjs
node scripts/migrate-vercel-google.cjs
```

Do not rerun `supabase_schema.sql` against existing data: that older bootstrap script drops tables. The new migration adds Google identity mappings, private support storage, persistent authentication rate limits and scheduler status. It prevents `anon` and `authenticated` Supabase roles from directly accessing the application tables; the API must connect as the database owner (`postgres` pooler user) or a properly privileged server role.

The migration helper imports the local support JSON if the destination is empty. It preserves the local file and does not overwrite existing conversations in PostgreSQL. Review its output if both locations already contain conversations.

In **Storage**, create a **private** bucket named `stall-uploads`, with a 3 MB limit. The API uses the service-role key to upload and issue one-hour signed links after checking record access. Never make the bucket public. Supported types are JPEG, PNG, WEBP, GIF and PDF. New uploads use this bucket; old files under `server/uploads` need the import helper described below before the local server is retired.

After setting the Supabase Storage credentials locally, run `node scripts/import-cloud-uploads.cjs` from `server` to copy old referenced maintenance/payment files to the private bucket and update their database references. It retains all local files, skips references already migrated, and stops on missing/oversized files. Verify attachments in the app before retiring local storage. Do this while uploads are paused so a concurrent edit does not leave an unused uploaded object.

## 2. Create the two Vercel projects

Push this repository to your own Git account, or deploy with Vercel CLI. Keep all `.env` files and credentials out of Git. The committed `.env.example` files contain only placeholders.

Create two projects from the same repository. Root directories are relative to the Git root (the folder containing this document):

| Setting | Website | Backend |
|---|---|---|
| Root directory | `webapp` | `server` |
| Framework | Vite | Express |
| Node version | 22.x | 22.x |
| Build/output | `npm run build` / `dist` | Framework defaults; no custom output directory |

Use the default free `*.vercel.app` domains. Do not buy a domain. Use the stable production project URLs, not changing preview URLs, for callbacks and API configuration. Website rewrites support direct navigation to `/auth/callback` and dashboard routes.

Set the backend variables from `server/.env.example` in **Project Settings → Environment Variables**. Generate independent random 32-byte values for `JWT_SECRET` and `CRON_SECRET` locally; keep both private. `SUPABASE_PUBLISHABLE_KEY` is public, while `SUPABASE_SERVICE_ROLE_KEY`, the database password, and PayMongo secrets are server-only. Set `CLIENT_URL` to the website origin with no trailing slash. Redeploy after setting variables.

Set the website variables from `webapp/.env.example`. `VITE_API_URL` must be the API's HTTPS URL ending in `/api/v1`. Vite embeds these public values at build time, so redeploy after editing them. Never use a service-role key in a `VITE_` or `EXPO_PUBLIC_` variable.

The API's `/health` confirms the function runs; `/api/v1` also checks database availability. Ensure the public API production deployment is not behind Vercel login/deployment protection: the phone, Supabase scheduler and PayMongo webhook must be able to reach it. Application routes still enforce their own authentication.

## 3. Enable Google in Supabase

Google sign-in uses Supabase Auth with PKCE. It is an additional login method, not mandatory two-factor authentication. Existing password login continues working. No MFA enrollment or MFA requirement is implemented here.

1. Open **Supabase → Authentication → Sign In / Providers → Google**. Copy the callback URL shown there (normally `https://PROJECT-REF.supabase.co/auth/v1/callback`).
2. In **Google Cloud Console → Google Auth Platform**, configure the consent screen and create a **Web application** OAuth client. This browser-based mobile flow uses that web client; it does not need the native Google Sign-In SDK. Add the exact Supabase callback as an authorized redirect URI. If asked for JavaScript origins, use your website origin.
3. Paste the client ID and client secret into the Supabase Google provider settings, then enable and save. The Google client secret belongs only in Supabase. Do not enable Google Cloud billing or paid APIs for this flow.
4. Under **Supabase Authentication → URL Configuration**, set Site URL to the deployed website and allow these exact redirect URLs:
   - `https://YOUR-WEBSITE.vercel.app/auth/callback`
   - `leasehub://auth/callback`
   - Optional local website development: `http://localhost:5173/auth/callback`
5. While Google's consent screen is in Testing, add the Gmail accounts that will test it. Publish the consent screen when appropriate for your intended users.
6. Copy the Supabase project URL and **publishable** key into the website, mobile and backend public-key variables. Legacy `anon` keys also work in these variables. Redeploy/rebuild.

New mobile Google accounts are tenants only. An existing email account must confirm its current password before connecting Google. Phone-only tenants should select **Already registered by phone? Connect your account to Google**, enter their existing mobile number/password above, then continue with Google. This retains their user ID and leases. The website requires an existing administrator account and its password for initial linking; Google cannot create an administrator.

Google-only accounts do not have a known local password. Continue using Google for these accounts; this change does not add password recovery or a new local password setup flow.

## 4. Mobile app

Copy the public variables from `mobileapp/.env.example` into the mobile build environment. Install the app with the `leasehub` scheme; changing this scheme requires a new native build. Google OAuth cannot complete in Expo Go because Expo Go does not register this app's custom scheme. Password login remains available there.

For a no-service-fee Android build, use the Android SDK/Java locally and `npx expo run:android` from `mobileapp`, or use an available free Expo build quota without upgrading. Local builds require disk space. A JavaScript export is only a bundle check, not an installable APK. iOS device distribution may require an Apple developer account; it is not part of the zero-cost Android plan.

On the current development machine, dependencies are on D: via directory junctions because C: ran out of space. Other machines and Vercel use normal `npm ci`. Use Node 22.13+ locally. The website dependency junction points to `D:/stall-leasing-dev/vercel-web-runtime/node_modules`; the mobile junction remains at `D:/stall-leasing-dev/expo57-upgrade/node_modules`. The locked residual `webapp/node_modules-move-remainder` is ignored and retained, not deleted.

## 5. Free scheduled billing

There is no Vercel Pro cron configuration. The Express function exports an app and does not start background intervals on Vercel. Local `node server.js` still runs its existing workers.

In Supabase Vault, create `stall_api_url` (API HTTPS origin, no trailing slash) and `stall_cron_secret` (same value as API `CRON_SECRET`). Enable Cron and pg_net, then run `server/scripts/supabase-schedule.sql` in Supabase SQL Editor. This calls the protected `/api/cron/maintenance` endpoint every 15 minutes. It does not create a paid subscription.

The request waits for due billing and payment reconciliation. Billing uses a database transaction/advisory lock; payment settlement checks provider data and locks the invoice. Repeated successful deliveries do not double-bill. Scheduled errors return 503 for investigation/retry. With many leases or slow PayMongo responses the job can exceed the function timeout; keep the demo small and monitor it.

Confirm actual HTTP success in `net._http_response` and confirm `scheduled_job_runs.last_success` advances. A cron job that merely queues an HTTP request does not prove success. The admin Billing screen reads the persisted last successful run. Free-tier pauses/quota exhaustion can delay bills; the next successful run processes missed due dates.

## 6. Optional PayMongo sandbox

Leave the payment secrets empty to keep online checkout unavailable. For a demo with simulated payments, use a separate demo database and set `PAYMENT_MODE=test` together with an `sk_test_` key. This explicitly allows test checkout on a production Vercel deployment and rejects live keys in test mode. Never mix demo invoices and actual rent records: sandbox settlement marks the demo invoice paid. The tenant checkout displays that no real money is collected.

Register a **test-mode** webhook for `checkout_session.payment.paid`:

```text
https://YOUR-API.vercel.app/api/v1/payments/paymongo-webhook
```

Set its signing secret and both return URLs from `server/.env.example`. Only list payment methods available to your test account. Live operation would require explicit live configuration, merchant activation, a suitable hosting plan and acceptance of PayMongo transaction fees; it is not enabled by this setup.

## Verification before sharing

- Register a password account: it must return to Login, with no saved session.
- Test Google consent cancellation, successful tenant login, existing phone-account linking, incorrect link password and admin role restrictions.
- Reload `/auth/callback` without a valid code: it should show a retry message, not authenticate.
- Restart/redeploy the API: support conversations and cloud uploads must remain accessible only to the authorized account/admin.
- Call cron without its secret: expect 401. Call with the secret: expect 200, then verify the persisted last-success timestamp.
- Repeat a scheduled job and a PayMongo webhook: no duplicate invoices/settlements.
- Verify the public Supabase key cannot read the application's `users`, payments or support tables directly.
- Run an installed Android build to verify the real Google browser callback. Mocked tests and JS exports cannot prove provider configuration.

References: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Hobby plan](https://vercel.com/docs/plans/hobby), [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Cron](https://supabase.com/docs/guides/cron), [Expo authentication](https://docs.expo.dev/guides/authentication/).

## Live QR Ph checkout

The mobile checkout is configured for QR Ph only (`PAYMONGO_PAYMENT_METHODS=qrph`). Confirm QR Ph is active in the receiving merchant account and that its settlement/withdrawal capabilities meet your needs.

Before enabling live payments, deploy the backend to a public HTTPS URL. In the backend environment, set `PAYMENT_MODE=live`, the account's live `PAYMONGO_SECRET_KEY`, and both `PAYMONGO_SUCCESS_URL` and `PAYMONGO_CANCEL_URL` to `https://YOUR-API/payments/return`. Keep secrets out of the mobile app and Git.

In PayMongo live mode, register `https://YOUR-API/api/v1/payments/paymongo-webhook` for `checkout_session.payment.paid`, then store that endpoint's signing secret as `PAYMONGO_WEBHOOK_SECRET`. Restart or redeploy the backend and point the mobile API configuration to it. Switching payment methods applies to new checkout sessions; existing sessions retain their original options.

Verify an authorized real payment against the correct invoice and check settlement in PayMongo before sharing with tenants. The current local test key and missing webhook configuration do not enable live collection.
