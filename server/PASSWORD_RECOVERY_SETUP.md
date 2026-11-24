# Tenant password recovery

## Supabase

1. Open the project used by Render’s `SUPABASE_URL`. In **Authentication → Email Templates → Reset Password**, set the subject to `MR99 - Password Reset Verification Code` and paste the full [MR99 recovery template](templates/password-recovery.html). Save the template.
2. Under **Authentication → Sign In / Providers → Email**, keep Email and email confirmation enabled. Use a six-digit email OTP and a **300-second** expiry. These settings are shared with registration. Under **Authentication → Rate Limits**, keep the recovery resend interval at **60 seconds** where configurable. The API separately applies the same cooldown and a five-guess limit per challenge.
3. Under **Authentication → SMTP Settings**, configure the verified sender address and SMTP host, port, username and password for tenant delivery if custom SMTP is absent. Verify the sender domain with your email provider. Test with a non-team Gmail address. [Supabase SMTP settings](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)

## Deployment

1. Confirm Render’s `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `JWT_SECRET` are configured. For a multi-instance Render deployment, set `AUTH_RATE_LIMIT_STORE=postgres` after confirming `auth_rate_limits` is available. Recovery needs the existing public Supabase key, and production JWT signing still uses the existing private JWT secret.
2. Apply [the additive password recovery migration](migrations/20261125_password_recovery.sql) in the database used by Render. Then release the backend through your approved Render workflow.
3. Confirm EAS **preview** has `EXPO_PUBLIC_API_URL=https://stall-leasing-server.onrender.com/api/v1` and the existing Google sign-in public Supabase settings. Rebuild the Android preview so the APK includes the Forgot Password screens.

## Account eligibility and session behavior

Supabase validates only recovery codes. MR99 compares the verified address with the existing active tenant and checks the Supabase identity ID when the tenant already has a link. A legacy tenant can recover with an existing Supabase identity that proves ownership of the exact MR99 email. Legacy accounts without a matching Supabase identity or with a phone-only placeholder need assisted recovery from MR99 support. Google-only tenants can enroll an MR99 password if recovery proves ownership of the linked Google identity and the MR99 email.

MR99 stores the login password as a bcrypt hash in PostgreSQL. Recovery updates that hash and increments the application session version in the same database transaction that consumes the reset grant. Earlier application JWTs fail the next authenticated request. Supabase handles email proof, and MR99 does not send the new application password to Supabase. The existing maintenance job prunes recovery challenges more than one day past expiry.

## Verify on Android

Use a dedicated tenant whose email matches a confirmed Supabase identity. Sign in on one device, then on a second device tap **Forgot Password?** and request a code. Confirm the email has six digits and enter it in MR99. Try a wrong code, check the cooldown, then resend and use the latest code. Set a different password and tap **Back to Login**. Confirm that the new password works, the old one fails, and the first device’s next authenticated request prompts it to sign in again. Repeat with an unregistered email and an administrator email to verify both receive the same in-app acknowledgement as a tenant.
