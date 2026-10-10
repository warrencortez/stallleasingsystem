# Vercel / Google implementation checks — 2026-10-10

- Server suite: 66 tests passed after Google login and protected scheduler integration.
- Final targeted server checks: 8 passed, including two added checks for explicit production sandbox mode and the Vercel entry point (68 distinct server tests in total).
- Mobile suite: 18 tests passed, including registration staying signed out, Google session establishment, cancelled OAuth and invalid callback rejection.
- Website production build: passed after Google callback UI and Linux-compatible optional native dependency configuration. Vite reports an existing large-bundle warning.
- Android JavaScript/Hermes export: passed, 1,000 modules. Generated assets are at `D:/stall-leasing-dev/google-auth-export` on the development machine. This is not an installed APK/device test.
- Git whitespace checks passed.

The Vercel entry-point test verifies no database startup work on import, lazy initialization, raw PayMongo webhook bytes, and an unauthenticated scheduler request being rejected. Google tests verify remote token rejection, verified-provider requirements, tenant-only provisioning, password-protected account linking, phone-only account linking, disabled accounts, and administrator restrictions.

Subsequent Supabase setup verification:

- The user supplied the project URL and publishable key; both are configured in the three ignored local environment files.
- Verified that the existing PostgreSQL credentials match the supplied Supabase project and Google is enabled.
- Applied `20261010_vercel_google.sql` successfully using `migrate-vercel-google.cjs`; imported existing local support conversations.
- Confirmed Google identity/support/rate-limit/job-status schema exists and application table RLS is enabled.
- Public-key-only HEAD requests to users, tenants, payments and support storage return HTTP 401. No user records were requested.
- A PKCE authorization request redirects from Supabase to accounts.google.com. User consent and successful Google account login remain untested.
- Reloaded the local API through its existing nodemon watcher. The Google login endpoint returns 401 for an intentionally invalid token instead of the prior unconfigured 503.
- Confirmed the running website loads the project URL and public key, and `/auth/callback` returns HTTP 200.

Not yet exercised: actual Vercel deployment, completed Google consent/account linking, Google callbacks on an installed phone, Supabase private Storage uploads, Supabase Cron delivery, or hosted PayMongo sandbox checkout/webhooks. These require account configuration described in `DEPLOYMENT.md`. No live payment, paid service activation or Vercel deployment was performed.

Environment repair: C: filled during dependency installation, interrupting a write to `server/server.js`. The server entry point was repaired and covered by the new runtime test. Website dependencies were moved to D: and the existing mobile D: junction restored. Locked website dependency remnants were retained and ignored rather than deleted.
