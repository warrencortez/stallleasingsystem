# Tenant registration and email verification

## Supabase dashboard

1. Open the project identified by Render’s `SUPABASE_URL`. Under **Authentication → Sign In / Providers → Email**, enable Email and keep **Confirm email** enabled. Under the sign-in settings, allow new users to sign up. Set **Email OTP length** to **6** and **Email OTP expiration** to **300 seconds**. The MR99 backend allows up to five minutes from the send request, using the database clock.
2. Open **Authentication → Email Templates → Confirm signup**. Set the subject to `MR99 - Verify Your Email Address` and paste the entire [registration email template](templates/registration-verification.html) into the body. Save the template. The signup and signup resend calls both use this template.
3. Under **Authentication → Rate Limits**, review the signup confirmation cooldown and keep it at **60 seconds** where configurable. With custom SMTP, set the email-sending limit to a volume your sender and expected traffic can support. The backend also enforces a 60-second resend cooldown, a five-guess limit per issued code, authentication rate limits, and a 24-hour registration window.
4. For tenant Gmail addresses, open **Authentication → SMTP Settings**, enable **Custom SMTP**, then enter your provider’s SMTP host, TLS port, username, password, and a verified sender email/name such as `MR99`. Verify the sending domain with the DNS records supplied by the SMTP provider. Save and test a new registration with a non-team Gmail address. Supabase’s built-in sender allows project team recipients and is limited to two messages per hour. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

## Render and Expo

1. In Render, open the deployed API service and verify `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` reference the same project. SMTP credentials belong in Supabase. For persistent API authentication rate limits on Render, set `AUTH_RATE_LIMIT_STORE=postgres` if the `auth_rate_limits` table is available and the service is ready to use the shared limit.
2. Apply [the base registration migration](migrations/20261015_registration_verification.sql) if the registration table is absent. Apply [the completion migration](migrations/20261125_registration_completion.sql) to the existing database before releasing the updated API through your approved Render deployment process.
3. Verify `EXPO_PUBLIC_API_URL` is `https://stall-leasing-server.onrender.com/api/v1` in the EAS **preview** environment. Keep the existing Google sign-in Supabase public values aligned with the backend project. Restart and reload Metro for Expo Go, or build a new preview APK to pick up the updated screen in an installed standalone app.

## Verification behavior

Supabase validates the signup code. The backend creates the tenant and marks the challenge completed in the same transaction. A repeat request for the completed challenge returns success without creating another user or issuing a session. The pending password hash is cleared after successful verification. A new code is subject to Supabase’s signup-token replacement behavior, so tenants should enter the code from their most recent email. Older pending registrations may need a fresh signup or resend after deployment.

Run the phone test with a fresh Gmail address and a mobile number that is unused in MR99. Submit the registration, enter a wrong code, then request a new code after the cooldown. Verify with the newest code and confirm you land on Login. Sign in with your original MR99 password. Repeat with the app backgrounded long enough for the code to expire. Use an installed APK for the Google and payment-return regressions.
