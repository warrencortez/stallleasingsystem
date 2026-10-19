# Tenant registration and email verification

Registration now uses Supabase Auth email OTP. No Resend SDK, SMTP password, or service-role key is needed in the mobile app.

## Supabase dashboard setup

1. Use the same Supabase project configured by the server's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and the mobile Google sign-in settings.
2. Enable the Email provider and allow new user signups. Set Email OTP length to **6** and Email OTP expiry to **60 seconds** in the Email provider settings. The application also independently rejects codes after 60 seconds and prevents resending for 60 seconds.
3. In Authentication > Email Templates, update **Magic Link** and **Confirm signup** to display the code rather than requiring a link. Use this body:

   ```html
   <h2>Verify your tenant email</h2>
   <p>Your verification code is:</p>
   <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>This code expires in 1 minute and can be used only once.</p>
   ```

4. The built-in Supabase sender is for testing: it sends only to project team addresses and permits 2 emails per hour. Configure custom SMTP in Supabase before opening registration to tenants. Provider limits still apply even after the app's resend countdown reaches zero.
5. Keep `leasehub://auth/callback` in Redirect URLs for Google sign-in.

References: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/auth-email-templates

## Backend and mobile

Apply `migrations/20261015_registration_verification.sql` to each target database before running the updated API. It was applied to the database configured in the local server environment during implementation. Restart the API and Metro (`npm run start:dev` in mobileapp). If using the deployed API, deploy these backend changes and apply the migration there as well. These mobile changes are JavaScript only and do not require a new development APK.

The API stores pending contact details and a bcrypt password hash in a private RLS-enabled table. It never stores or returns the email code, Supabase session, or plaintext password. Supabase creates an Auth identity when sending an OTP; the application's tenant user is created only after successful verification. Five wrong guesses block that code until a new one is requested. Delivery failures do not report success. Resending invalidates the old Supabase OTP. A successful verification consumes the pending registration transactionally. Codes are verified only on the backend.

New Google users receive a contact-details prompt before an application session is issued. Their verified email comes from Supabase, never from client input. Existing linked users sign in normally; existing password accounts still require their password when linking Google. Admin registration remains forbidden.

Expired pending registrations may be pruned with `DELETE FROM public.registration_verifications WHERE created_at < NOW() - INTERVAL '1 day'`; old pending registrations cannot be resent after one day.

## Validation

Run `node --test test/*.test.js` from server. For database integration coverage set `RUN_DB_AUTH_TESTS=1` and run `node --test test/registrationVerification.test.js`. Integration tests use temporary tables and rollback; email delivery is mocked and no real accounts are created. Run `node --test test/*.test.cjs` from mobileapp.

Actual delivery and phone execution require the Supabase dashboard setup above and a fresh registration using an allowed recipient.
