# Whole-system QA and developer repair report - October 2, 2026

This replaces the previous QA report and the September 29 repair report. Scope: administrator web application, tenant Expo application, Express API and configured PostgreSQL database. This is a fresh verification run, not a reuse of the old pass results. Requested feature repairs and reproduced functional defects below are fixed. **This is not an every-button, physical-device or production-payment certification.** Remaining coverage and environment limits are explicitly listed.

## Latest continuation: lease anniversaries and hosted checkout

Implemented and migrated automatic rent billing. A monthly lease beginning June 1 first bills July 1; a daily lease beginning June 1 first bills June 2 and continues daily. Short months clamp to month end without permanently shifting the anniversary. Only active, assigned leases with valid dates/rates are billed; notifications belong to their tenant user. Existing leases are activated without historical backfill. PostgreSQL saves new-lease schedules immediately, catches up missed scheduled days after downtime, and prevents duplicate invoice periods. The running localhost server has reported a successful worker check with no errors and three saved schedules.

Replaced the mobile manual receipt/reference submission form with PayMongo hosted checkout and office payment instructions. Added signed raw-body webhooks, independent provider verification, transactional settlement/notification, provider payment ID uniqueness, and periodic reconciliation. Reopening an existing checkout reuses it. Invoice edits and late-fee changes cannot alter a bill with an open checkout. New tenant manual-reference submissions are rejected; legacy pending submissions can still be reviewed.

**Current release limitation:** the user now has PayMongo account/API-key access, but live activation and public HTTPS hosting remain unconfirmed. Local configuration still uses a test key and lacks the webhook secret and HTTPS return URLs. Real-money payments are not enabled. The app displays online payments unavailable and directs tenants to the office. Configured test mode is explicitly labelled. No real charge was attempted. Provider end-to-end tests, physical phone taps, refunds/disputes, partial payments, and self-service expiration of a checkout before switching to cash remain outside verified coverage. See [payment setup and operational requirements](../server/PAYMENTS_SETUP.md).

Latest verification (October 2):

- **70/70 combined server/mobile regression tests pass**, including anniversary/month-end/leap-year dates, Manila rollover, webhook signature tampering/replay/mode checks, amount/currency/ownership validation, unavailable-payment UI, and existing core flows.
- **6 recurring/payment PostgreSQL groups pass**, including no historical backfill, downtime recovery, lease end/inactive guards, preserved rates, duplicate settlement/notification, and checkout reuse/locked invoice amount. All test rows/schema rolled back; provider calls are mocked.
- **9 existing core PostgreSQL groups rerun and pass**, with all fixtures rolled back.
- **15/15 read-only HTTP endpoints pass** on the running local server, including billing status and payment readiness.
- **4 targeted browser checks pass** against the running admin website: billing modal and worker status at 1440px/375px, stall explanation, and no uncaught browser exception. No customer payment was submitted.
- Final admin production build passes; large-bundle warning remains. Final Android (943 modules) and iOS (948 modules) production exports pass. This is build verification, not a physical-device or provider certification.

New evidence: `recurring-regression.txt`, `recurring-postgres-results.json`, `recurring-browser-results.json`, and refreshed `current-live-http-results.json`. New migration: `server/migrations/20261002_recurring_billing.sql`; run after the daily/cash migration on other databases. Deployment instructions are in `server/PAYMENTS_SETUP.md`.

The earlier whole-system observations below remain historical evidence; this continuation supersedes the old manual daily/monthly batch flow and manual tenant-reference UI.

## Findings, reproduced behavior and repair priority

| ID | Priority | Reproduction / original defect | Implemented repair and verification |
|---|---|---|---|
| F01 | High | Tenant dashboard Report Fix navigated to `Maintenance`, which is not a registered tab. | Targets `Fix Hub`. Execute the real dashboard callback in a component test; scan all literal mobile navigation destinations against registered routes. Pass. |
| F02 | High | Daily rent existed as a description marker; no structured daily billing period/rate. Stall edits sent a nonexistent column; monthly generation also treated daily leases as monthly. | Applied migration for `rent_type`, `daily_rent`, `billing_type`, `billing_period`. Daily batch bills only active linked leases within their contract dates. Monthly batch excludes daily leases. Transaction lock plus unique period index prevents duplicates. Daily creation/edit forms, PostgreSQL integration and concurrency regressions pass. |
| F03 | High | Administrator could not record a dedicated walk-in office payment with cashier and receipt tracking. | Billing > Record Walk-in Payment selects a specific invoice, validates full amount including late fee and a unique office receipt, stores `cash_office`, date and cashier ID, and opens the settled receipt. Admin-only; row lock and paid guard prevent duplicate settlement. Pending proof or an existing online checkout blocks cash settlement until reconciled. HTTP regressions and actual browser form/receipt pass. |
| F10 | High | Settled receipts and several collection summaries omitted late fees even though payment required the fee. | Receipt total, collection totals, tenant summary, analytics and stall history aggregates include late fees. Real PostgreSQL test confirms 120 + (100 + 10) produces total collections 230; browser receipt shows 130 for a 120 invoice with fee 10. |
| F04 | Medium | Staff member remained assignable from Users. | Removed dropdown choices; server rejects staff assignments; authentication and schema allow only admin/tenant. Live role inventory had zero staff, so no accounts were converted. Prevent self-demotion/deactivation. DB-backed controller checks pass. |
| F05 | Medium | Administrator floating chat included the tenant-style chatbot. | Replaced with tenant inbox only. Tenant app chatbot unchanged. Browser opens inbox, takes over tenant conversation and sends a message. Support service tests verify handoff, isolation and return to assistant. |
| F06 | Medium | Bill-generation success toast used `generatedCount`, while API sends `count`. | Toast reads actual count; daily generation exercised through browser. |
| F07 | Medium | Stall deletion error/success paths referenced undefined `toast`. | Added missing import. Final lint has no `no-undef` finding. Destructive deletion was not tested against customer records. |
| F08 | Medium | One failed billing request discarded other successful responses and left a misleading empty/stale page. | Handle responses independently with `Promise.allSettled`; show an error and Retry. |
| F11 | Medium | Fix Hub connection failure could display no active rent/no tickets; background polling continued off screen. | Explicit load error and Retry; successful lease load required before no-lease state. Refresh while focused; preserve valid selected stall and discard stale selection. Component tests cover report payload, no-lease and network failure. |
| F12 | Medium | Whitespace-only maintenance reports and invalid category/status reached persistence; negative stall edits were not validated. | Reject these inputs with 400 before SQL. Maintenance validation, owned-stall creation, completion, notification and foreign-account denial pass against PostgreSQL. |
| F13 | Medium | Reports crashed at `pm.method.replace` when QA/demo analytics contained a missing method. | Safe unknown-method label; corrected demo payment-method grouping. Strengthened browser audit to fail on the React error boundary as well as uncaught exceptions. Reports now renders. This specific crash was reproduced in the disposable fixture, not proven in live data. |
| F14 | Medium | Announcement update accepted arbitrary column keys. | Explicit editable-column list; PostgreSQL test confirms content can change without reassigning the author. |
| F09 | Investigated | Earlier screenshot showed `/payments/stalls-overview` returning 500. | Not reproducible now: direct database query, temporary HTTP harness and user's running localhost:5000 endpoint succeed. No unsupported claim about the original cause. Other screenshot `[API RES 200]` entries were successful requests. |

## Test results

- **61/61** server and mobile regression tests pass. Covers authorization, no-lease billing isolation, foreign invoice access, authentication/passwords, application approval/rollback/races, daily/monthly billing, cash conflicts, payment verification failure, mobile payment states, maintenance navigation/submission/offline recovery, and tenant support privacy/handoff.
- **9 PostgreSQL integration check groups pass**, using a separate schema inside one transaction. Schema and all synthetic rows are rolled back. Tests cover daily/monthly periods, duplicate prevention, rent edits, cash settlement and late-fee totals, stall billing overview, application approval, maintenance workflow/notification, announcement CRUD/author protection, and role restrictions.
- **13 read-only HTTP checks pass on the user's running `localhost:5000` server**: billing overview/stats, analytics in all four timeframes, monthly report, stall/tenant/application/maintenance stats, maintenance list and announcements. Status 200 and `success: true` required.
- **29 browser page observations and 11 workflow groups pass** in hidden Chrome against production web build and a disposable API fixture. No unexpected HTTP errors, React error-boundary pages, uncaught exceptions or horizontal page overflow in this final run. Widths: 1440 and 375 pixels. See evidence JSON for exact paths, visible controls and actions.
- Admin production build passes. Android and iOS Expo exports pass (937 and 939 modules respectively), stored on D: to avoid filling C:.
- `git diff --check` passes. Web lint remains **193 errors / 25 warnings**, mostly unused bindings and React hook/compiler rules; no undefined-variable findings remain. This is a known quality backlog, not a claim of 193 reproduced runtime failures.

## Coverage matrix and button/navigation checks

| Area | Executed verification | Remaining manual / device coverage |
|---|---|---|
| Authentication | Admin browser login and redirect; corrupt browser storage returns to login; registration privilege and repeated login/password regressions. | Device keyboard, autofill, session expiry during foreground/background changes. |
| Dashboard / navigation | Admin route render at desktop/375px; real mobile Report Fix callback; every literal mobile navigation target registered. | Every icon and dynamic notification deep link on a phone. |
| Stalls / leasing | Browser create daily stall, edit rate and return to directory; detail/edit routes render; PG approval creates lease and occupies stall; competing approval tests. | Camera QR scan, physical printed QR, device file/image picker. |
| Tenants / applications | Directory, profile and edit routes render; new-tenant route redirects to directory; approval ownership/rollback/concurrency tests. | Every admin edit/delete confirmation and all attachment combinations. |
| Billing / cash | Browser selects invoice, enters amount/reference, submits and opens correct receipt; daily generation modal; ownership, period bounds, concurrency, duplicate receipt, paid and online/proof conflict tests; real DB totals. | Physical receipt printing; live provider payment/reconciliation; partial payments are unsupported. |
| Maintenance | Browser report modal opens/cancels; real mobile form callback submits owned stall; actual PG controller creates/completes report and notifies tenant. | Camera/photo upload and every technician/detail control on devices. |
| Users | Staff absent from options; API rejects staff and self-access removal; role constraint migrated. | Every account deletion/pagination/search combination. |
| Tenant chat | Browser tenant inbox takeover and send; service tests for persistence/retries, cross-tenant isolation and assistant handoff. | Phone keyboard, push/background delivery and long real-world conversations. |
| Announcements / notifications | PG announcement CRUD and protected author; maintenance notifications; notification ownership regressions; web routes render. | Every broadcast target/UI dialog and device notification tap. |
| Reports / analytics | All four analytics endpoints live; monthly report live; Reports error-boundary fix and desktop rendering; total calculations tested. | Printed/downloaded report layout and large production datasets. |
| Responsive admin | Dashboard, billing, maintenance, users, conversations and stalls at 375px; all inspected desktop pages fit viewport. | Additional real browsers, touch devices, zoom and accessibility tooling. |
| Mobile runtime | All literal destinations checked, important component callbacks executed, payment and maintenance states tested, Android/iOS bundles compile. | No connected physical Android/iOS device or emulator was available for a complete native tap-through. Compilation is not device execution. |

The generated `current-control-inventory.json` lists source action/navigation sites, and browser results list visible buttons/links for each inspected page. These are inventories, **not pass claims for every listed button**. Deleting customer data, sending real payments or broadcasting production announcements was not used as QA.

## Operational decisions and deployment notes

- Daily and monthly rent now follow the saved lease anniversary schedule automatically. Admin: Billing & Payments > Run Due Billing checks due schedules without selecting arbitrary periods. See the latest continuation above.
- Walk-in means full cash settlement of an existing bill. Amount must equal rent plus fee; receipt is required and unique without case distinctions. A pending online checkout/proof must be reconciled before cash is accepted. No partial-payment ledger or provider cancellation was introduced.
- Applied `server/migrations/20261002_daily_cash.sql` to the configured database. It adds billing and cashier fields/indexes, converts legacy DAILY description-tag rates and restricts account roles. It does not settle, delete or rewrite existing invoice amounts/statuses. Fresh schema includes the same migration. Runner: from server, `node scripts/migrate-daily-cash.cjs`.
- Existing mobile users should reload the Expo app to load the updated bundle. Production mobile builds require a reachable HTTPS `EXPO_PUBLIC_API_URL`; no production URL was invented.
- C: exhausted during QA, causing ENOSPC while writing result files and seven temporary-storage test failures. Removed only the old generated QA Chrome profile; reran successfully with TEMP/TMP and exports on D:. C: still had about **61 MB** free at the final check. More disk capacity is required for reliable ongoing development.
- Node is 22.11.0; installed Vite warns that it expects 20.19+ or 22.12+. Build succeeded, but runtime upgrade remains environment work. Web bundle is about 976 KB before gzip and reports a chunk-size warning.
- Existing broad web lint backlog requires a dedicated cleanup; physical-device tests, provider reconciliation and large-data/load tests remain release gates. No claim of whole-system release certification is made.

## Evidence and rerun instructions

- `current-execution-summary.json`: final counts and build outcomes.
- `current-browser-results.json`: page snapshots, visible controls, workflow checks and unexpected API errors (empty).
- `current-control-inventory.json`: source action/navigation inventory.
- `current-postgres-results.json` and `current-postgres.cjs`: rollback-only integration results and executable test.
- `current-live-http-results.json` and `current-live-http.cjs`: read-only endpoint checks. Set `QA_HTTP_BASE=http://localhost:5000` to test the existing server.
- `current-lint.json` / `current-lint-final.json`: baseline and final lint evidence.
- Screenshots and final Android/iOS exports: `D:/stall-leasing-qa-20261002/`.

Run regressions from repository root: `node --test server/test/*.test.js mobileapp/test/*.test.cjs` (set TEMP/TMP to a drive with space). Run PostgreSQL scripts from `server` so local .env is resolved; they do not print credentials. For disposable browser tests, build webapp, start `node qa/current-fixture.cjs`, then run `node qa/current-browser.cjs`. Reset the disposable fixture between full runs because form tests intentionally create and settle synthetic records.


## Expo Go compatibility follow-up

User reproduced an SDK mismatch: installed Expo Go expects SDK 57, project was SDK 54. Upgraded Expo to 57.0.26 and aligned React, React Native and Expo modules with its dependency map. Migrated legacy splash configuration to the SDK 57 splash plugin. Added a direct app entry, supported Metro external dependency path and a launcher using compatible Node with D-drive caches. Preserved all prior feature repairs.

Fresh results: dependency check passes; Expo Doctor **21/21**; mobile regression tests **9/9**; Android and iOS production exports pass. The restarted LAN Metro manifest advertises `sdkVersion: 57.0.0` and `runtimeVersion: exposdk:57.0.0`. The Android development bundle returned **HTTP 200, 5,790,655 bytes**. This validates serving/bundling, not a physical device launch. See `expo57-manifest-check.json` and `mobileapp/README.md`. The current fresh QR is in `expo57-qr.png` and is only valid on the current Wi-Fi/IP while Metro runs.


## Handover blocker follow-up: mobile terminal asset failures

Read the actual running Metro output after the user opened the app on a phone. Reproduced repeated `ENOENT ... mobileapp/D:/.../Fonts` errors and `ExpoAsset.downloadAsync` failures. Cause: the cross-drive dependency layout introduced during the SDK upgrade caused Metro's `./D:/...` asset URLs to resolve relative to C:. Earlier successful bundle/export checks did not exercise those runtime asset downloads.

Fixed in `mobileapp/metro.config.js` and `scripts/metro-assets.cjs`: normalize only cross-drive asset paths inside the configured dependency watch root. Keep unrelated requests unchanged and reject path expansion outside that root. Restarted Metro through `npm start`. Added regression coverage and a real asset-download test.

Verification: **63/63 combined regression tests**, **106/106 actual font/image HTTP downloads** for Android and iOS, and **13/13 read-only live API checks** pass. The new Metro session has produced no further asset errors during these checks. Physical-phone confirmation after reload remains separate. Evidence: `mobile-assets-results.json` and `mobile-assets-check.cjs`.

C: was again at zero bytes free. Removed only the approximately 200 MB failed DevTools download cache under LocalAppData/dotslash/33; current Expo uses D-drive caches. This restores working space, but is not a permanent storage-capacity solution. Updated outdated README SDK, role, startup-command and demo-login instructions to avoid misleading the HOA handover.

Additional final checks: Android development bundle HTTP 200 (5,790,655 bytes), iOS development bundle HTTP 200 (5,790,572 bytes). Removed the obsolete npm download cache on C (about 622 MB); final C free space was 815,452,160 bytes. Installed dependencies remain in their configured locations. Physical phone reload confirmation was requested separately.

## Administrator database sign-in follow-up

Removed the hardcoded email/password from the web login form, the fallback administrator email in the navbar, and the default admin seed from the fresh database schema. Kept the existing active PostgreSQL administrator account and replaced its password with a newly generated credential stored as a bcrypt hash. Credentials were supplied directly to the owner and are not saved in this report or application source. Added an explicit operator-only provisioning script for future deployments; existing-account password resets require its `--reset-password` flag.

Website session restoration now calls `/auth/me` and uses the database identity instead of trusting a cached role/name. Executed actual API and browser form sign-in: new password accepted, `admin123` rejected, authenticated profile succeeds without a password hash, and a forged cached profile is replaced after reload. Five browser/API checks pass (`admin-login-results.json`); 70/70 regressions and the production web build pass. Browser test uses process environment credentials and does not persist them in QA output. Fresh-schema deployments must provision their own administrator, not use a shared default password.

C: filled again and blocked the command launcher. Removed only the verified old generated LocalAppData Temp Metro cache (about 62 MB); tests/build output use D:. Available C: space remains very limited.
