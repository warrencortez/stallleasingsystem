# Free hosting with live QR Ph

Hosting target: Netlify Free for two sites and existing Supabase Free. No custom domain or paid add-ons are required. Free quotas can pause service; this is not an unlimited uptime commitment. PayMongo transaction deductions remain payable by the receiving partner. No tenant surcharge has been enabled.

## 1. Push the prepared source

Push the latest changes to the existing GitHub repository. Keep .env files and credentials private. Include server/package-lock.json and the two netlify.toml files.

## 2. Prepare existing Supabase

Follow the database, storage and migration steps in DEPLOYMENT.md section 1. Back up existing data; never rerun the destructive bootstrap schema. Retain the existing private stall-uploads bucket and the current registration/Google configuration. The historical migrate-vercel-google.cjs migration also supports Netlify; its name does not restrict hosting.

## 3. Create the backend site

In Netlify, import the GitHub repository and choose the Free plan. Set base directory to server (or its actual path relative to the GitHub root). The checked-in server/netlify.toml supplies build, publish and functions directories. Do not choose a paid plan or add-ons.

Copy the real backend variables from server/.env into Netlify's environment settings using server/.env.example as the checklist. Never upload the .env file to GitHub. Use NODE_ENV=production, DEMO_MODE=false, DB_SSL=true, SUPPORT_STORE=postgres, UPLOAD_STORAGE=supabase and AUTH_RATE_LIMIT_STORE=postgres. Use the Supabase transaction pooler host, port 6543 and its exact username. Configure independent random JWT_SECRET and CRON_SECRET values; CRON_SECRET needs at least 32 characters. Keep payment keys empty until the public endpoint is verified.

Deploy and save the assigned https://YOUR-API.netlify.app address. Verify /health and /api/v1 return successfully; the latter also checks database availability. Live payment verification still requires the later steps.

## 4. Create the admin website site

Import the same repository as a second Free site with base directory webapp. Its netlify.toml supplies npm run build, dist and SPA redirects. Set VITE_API_URL=https://YOUR-API.netlify.app/api/v1 plus VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Never place server secrets in VITE_ variables.

Deploy, copy the assigned website address, and set backend CLIENT_URL to that origin without a trailing slash. Redeploy the backend. Add https://YOUR-WEBSITE.netlify.app/auth/callback to Supabase's allowed redirect URLs and update its Site URL. Keep leasehub://auth/callback for the Android development build.

## 5. Enable live QR Ph

Confirm QR Ph and settlement/withdrawal access in the partner's PayMongo account. In backend environment settings set PAYMENT_MODE=live, PAYMONGO_PAYMENT_METHODS=qrph and the live PAYMONGO_SECRET_KEY. Set both PAYMONGO_SUCCESS_URL and PAYMONGO_CANCEL_URL to https://YOUR-API.netlify.app/payments/return.

In PayMongo LIVE mode create a webhook for https://YOUR-API.netlify.app/api/v1/payments/paymongo-webhook subscribed to checkout_session.payment.paid. Store its signing secret as PAYMONGO_WEBHOOK_SECRET on the backend, then redeploy. Never put these secrets in the website, mobile app, GitHub or chat. Keep PayMongo fee pass-through disabled: the tenant pays the invoice balance and the partner receives the provider's net settlement.

## 6. Connect Android and schedules

In mobileapp/.env set EXPO_PUBLIC_API_URL=https://YOUR-API.netlify.app/api/v1 and retain the existing public Supabase settings. Restart Expo with npm start -- --clear. For an installed release, embed that URL in a new APK build.

In Supabase Vault, set stall_api_url to the backend origin and stall_cron_secret to the backend CRON_SECRET. Apply server/scripts/supabase-schedule.sql as described in DEPLOYMENT.md; it works with the Netlify URL too. Check actual HTTP success in net._http_response and advancing scheduled_job_runs.last_success. Do not run multiple local or cloud billing schedulers against the same production database during cutover.

## 7. Validate before community handover

Verify login, registration, Google callback in an installed APK, private attachments and admin access. Verify an authorized real payment against a designated invoice: PayMongo payment success, successful signed webhook delivery, exact invoice paid once, receipt and settlement. Cancelling checkout must leave the bill outstanding. A paid invoice records the full rent satisfied, not the smaller net merchant settlement; reconcile provider fees in PayMongo separately.

Inspect Netlify usage during the pilot, including both sites. Free has a shared monthly credit cap and can pause sites at that cap; don't enable paid upgrades. Supabase Free has storage/egress limits and may pause with low activity. Some screen/chat polling still remains; measure it before assuming ten users will stay within quotas. Keep office payment available if online services are unavailable.

Sources: https://docs.netlify.com/build/frameworks/framework-setup-guides/express/ ; https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ ; https://www.bsp.gov.ph/Media_and_Research/Primers%20Faqs/QR_Ph_P2M_FAQs.pdf
