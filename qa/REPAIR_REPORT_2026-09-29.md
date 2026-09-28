# Tenant mobile app and server repair verification

September 29, 2026. Scope follows the user's clarification: the Expo tenant app and its server. The web portal received a shared-session recovery fix and a compatibility build check. This is a prioritized repair pass, not production certification.

## Repairs completed

| Area / original finding | Change | Evidence |
|---|---|---|
| Registration and login: QA-01, QA-02, QA-07, QA-08 | Public signup always creates a tenant. Removed administrator bootstrap/reset and plaintext/demo password bypasses. Public user serialization excludes passwords without mutating storage. Password change retrieves the internal hash. Partial demo profile updates preserve unrelated fields. | HTTP registration, repeated login, wrong-password, password-change and profile tests; original audit probes. |
| Tenant isolation: QA-03, QA-05 | Invoice lists use authenticated user ownership, including multiple leases. Individual invoice reads, checkout and receipt uploads check ownership. Tenant profiles, applications, maintenance, announcements and stall responses enforce their access boundaries. Tenants can now fetch their own applications; they cannot override the user filter. | HTTP foreign-account and unlinked-account tests. Source checks cover public stall projections and announcement audience filtering. |
| Payment integrity: QA-04, QA-11 | Provider failures no longer return simulated success. Verification uses the invoice's stored checkout ID and checks the provider's paid payment, amount and PHP currency; production rejects test-mode sessions. Manual submissions remain pending. Closing mobile checkout only triggers server verification. The app no longer invents receipts. Late fees appear in displayed totals. A late receipt write cannot change an already-paid invoice back to pending. | Null/unpaid/foreign/wrong-amount provider fixtures; provider-outage test; mobile component callback tests for manual, cancelled and verified payment. No real provider was contacted. |
| Invoice validation: QA-12, QA-17 | Reject negative/invalid amounts and calendar dates on creation and editing; prevent invoice ownership reassignment through generic editing. Creation requires an active assigned stall. Monthly generation respects contract months and serializes generation in a transaction with a PostgreSQL advisory lock. | Invalid-input HTTP tests, lease-period and repeat-generation tests, simultaneous-generation demo test. Real PostgreSQL concurrency remains untested. |
| Applications and leases: QA-09, QA-10 | Submission validates required contact information, attaches the signed-in account, and rejects duplicate pending applications. Submission and approval lock the stall in a transaction. Approval creates a separate lease per stall, rejects competing applications and writes notifications atomically. Failure rolls everything back instead of reporting a partial success. | Submission-to-approval-to-maintenance HTTP journey, second-lease preservation, injected notification failure rollback, competing-approval demo tests. |
| Persistence: QA-06 | Persistent query errors propagate instead of writing into a second memory dataset. Startup waits for database readiness. Temporary storage requires explicit non-production DEMO_MODE. Model queries share the transaction's database connection. | Database-unavailable, production-demo rejection, live-client error propagation and rollback tests using a controlled pg client fixture. |
| Notification schema: QA-13 | Emitters use notification types accepted by the existing supplied schema, including stall availability and completed maintenance. Mobile application notifications still navigate to Stalls. | Re-run schema comparison: no unsupported emitted types. |
| Mobile connectivity and sessions: QA-14, QA-19 | Release builds use EXPO_PUBLIC_API_URL and require HTTPS. Development still supports Expo host discovery and a local IP override. Damaged saved sessions are cleared; staff accounts cannot enter the tenant app. A failed current-password check no longer signs the user out. Web corrupted-session recovery was also added. | Mobile session fixture test, source review, Android/iOS exports and web build. Hosted HTTPS connectivity not executed. |
| Mobile display and failure states | Removed the invented PHP 15,000 rent for accounts with no lease. Lease/profile matching uses authenticated user IDs. Billing reads real contract fields and shows a retry state on network failure instead of claiming no debt. | Source review; mobile offline and payment-total component tests. |
| Additional authentication finding | A missing or known default JWT secret now prevents ordinary server startup; only explicit local demo mode can generate an ephemeral secret. | Missing/default-secret regression tests. |

## Executed verification

- Combined automated suite: **54 tests passed** (49 server tests and 5 mobile component/session tests).
- Original isolated API audit: **15/15 passed**; `api-results.json` now records this rerun.
- Original logic/schema audit: **4/4 passed**; `logic-results.json` now records this rerun.
- Android Hermes export: **passed**, 937 modules, approximately 2.93 MB bundle.
- iOS Hermes export: **passed**, 939 modules, approximately 2.93 MB bundle. The first attempt failed because C: was full. The successful retry used `D:\stall-leasing-qa-20260929\ios-export` and temporary files on D:. Only this pass's generated Android export was removed to reclaim space.
- Web production build: **passed**. Existing Node 22.11 versus Vite 22.12+ compatibility and bundle-size warnings remain.
- Diff whitespace validation: passed.

The mobile tests transpile the actual BillingScreen/AuthContext source and execute callbacks with deterministic hook, storage, browser and API fixtures. They are not native rendering, touch, accessibility or device integration tests. Server tests use isolated demo data or controlled database/provider fixtures. No real account, invoice, transfer or production database was modified.

Run from the repository root:

```powershell
node --test server/test/*.test.js mobileapp/test/*.test.cjs
node qa/api-audit.cjs
node qa/logic-audit.cjs
```

Both `server` and `mobileapp` now also expose `npm test`.

## Configuration required

For persistent operation, configure the existing PostgreSQL settings and a private `JWT_SECRET`, then restart the server. Database failure now fails visibly. For disposable local demonstrations only, explicitly set `DEMO_MODE=true`; demo data is temporary and is never enabled in production.

For a tenant app release, set `EXPO_PUBLIC_API_URL=https://your-server.example/api/v1` before building. For online payments, configure PayMongo credentials and the success/cancel redirect URLs. Provider configuration/network errors leave invoices outstanding. Existing data was not migrated, deleted or reconciled.

The payment verification implementation was checked against PayMongo's [Checkout Session resource](https://docs.paymongo.com/reference/checkout-session-resource): checkout session status itself is not proof that a payment was settled.

## Still open before release

- Real PostgreSQL approval/billing concurrency, rollback, constraints and schema integration; payment-provider sandbox end-to-end tests, webhook/reconciliation coverage and duplicate checkout handling.
- Physical Android/iOS interaction, actual checkout return/cancellation, hosted HTTPS/LAN connectivity and native accessibility. No Android device/emulator was available in this environment.
- Daily rent calculation/proration policy, comprehensive database monetary constraints, and historical billing corrections. Monthly billing repairs do not implement daily billing.
- Remaining demo statistics/emulator inaccuracies, broad input-validation coverage, polling/load optimization, mobile visual/accessibility audit, and the older report's lower-priority portal/QR/staff/build-portability findings.
- C: remains critically short of free space. Further builds or local database writes need adequate disk capacity.

The September 25 assessment remains useful historical context; its failed results should not be read as the status of the repaired paths above.
