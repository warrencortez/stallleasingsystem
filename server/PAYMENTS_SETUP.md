# Automatic rent billing and online payments

Automatic billing uses Asia/Manila calendar dates and each active tenant lease's `contract_start`. Creating a vacant stall does not create bills. A June 1 daily lease first bills June 2; a June 1 monthly lease first bills July 1. Monthly dates 29–31 use the last day of shorter months and return to the original anniversary in later months. The lease rate is captured when the schedule is created; later stall listing price changes do not silently change existing contracts.

The worker runs at server startup and every minute. PostgreSQL stores the next due date. A database lock, a unique invoice period and a transaction protect against repeated or concurrent runs. New leases receive a schedule through a database trigger, so bills missed while the server is offline are processed after restart. Existing leases at migration activation start at the next due occurrence on or after activation, without historical backfill. Inactive leases are not billed; contract end dates bound generation. Delivery means an invoice and an in-app notification, not SMS, email delivery or an automatic bank debit.

Run migrations from `server`, in order, on each deployment database:

```
node scripts/migrate-daily-cash.cjs
node scripts/migrate-recurring.cjs
```

Keep the server running with a process supervisor on an always-on host. Billing > Run Due Billing displays the worker's last successful check and any schedule warning. This button only processes currently due schedules; it cannot select an arbitrary day/month or charge every tenant universally. A changed lease start/stall must be reviewed against its saved schedule; the worker skips mismatched schedules rather than guessing how to rebill historical charges. Full cash settlement remains available through Record Walk-in Payment with the office receipt number and cashier audit.

## PayMongo configuration

The user now has a PayMongo account/API-key access. Live merchant activation and public HTTPS hosting are not yet confirmed. The local server currently has a test-mode secret key; its webhook secret and HTTPS return URLs are not configured. **Real-money operation is not enabled or certified.** The app now shows online payments unavailable and directs tenants to the office. Do not put secret keys in the mobile app, web app, repository, or chat.

After deploying the API on a public HTTPS domain and setting up the merchant account, configure server environment variables:

```
PAYMONGO_SECRET_KEY=<server-only test or live secret>
PAYMONGO_WEBHOOK_SECRET=<secret for the registered webhook>
PAYMONGO_SUCCESS_URL=https://YOUR-API-DOMAIN/payments/return
PAYMONGO_CANCEL_URL=https://YOUR-API-DOMAIN/payments/return
PAYMONGO_PAYMENT_METHODS=gcash,card
```

Only list methods enabled on the merchant account. Configure the tenant build's `EXPO_PUBLIC_API_URL` to the deployed HTTPS API base, including `/api/v1`. Configure CORS `CLIENT_URL` for the deployed admin portal. `NODE_ENV=production` rejects test keys and test settlements by default. For an explicitly isolated, zero-cost sandbox demo, `PAYMENT_MODE=test` permits test keys and rejects live keys; use a separate demo database. See [the Vercel and Google setup guide](../DEPLOYMENT.md).

Register `https://YOUR-API-DOMAIN/api/v1/payments/paymongo-webhook` for `checkout_session.payment.paid`. Ensure any reverse proxy preserves the request body and signature header. The handler validates the raw-body HMAC signature and timestamp, then independently retrieves the session using the server secret. Settlement requires the saved checkout ID, invoice metadata, mode, PHP currency and full amount including fees. The provider payment ID and tenant confirmation are stored transactionally; repeated callbacks cannot create another confirmation. Background reconciliation also checks unsettled sessions in batches of 20 every minute.

The tenant chooses a payment method on PayMongo's hosted page. There is no manual bank-reference or receipt-upload requirement. The return page tells the tenant to return to Billing; a redirect alone never marks a bill paid. Existing active checkouts are reused. Invoice edits and fee changes are blocked while checkout exists to avoid charging a different amount from the recorded bill. Old pending manual submissions may still be reviewed by an administrator; new tenant manual-reference submissions are rejected.

Before switching keys to live, exercise success, declined payment, cancellation, app closure, webhook retry and missed-webhook recovery using the merchant's test environment. Test every enabled channel. Then perform a controlled live acceptance test and verify both PayMongo settlement and the HOA invoice/receipt. These provider/device tests cannot be completed without the missing account and hosted endpoint.

An invoice with an open online checkout cannot also be accepted as cash. Reconcile/expire the provider checkout and have a developer verify the absence of pending/paid attempts before changing channels. Self-service provider cancellation, refunds, disputes and partial-payment accounting are not implemented in this change.

Official integration references: [Hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout), [checkout session fields](https://docs.paymongo.com/reference/checkout-session-resource), [webhook signatures and setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).
