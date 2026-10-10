# 🏪 Dela Costa HOA Stall Leasing

A multi-platform Dela Costa HOA Stall Leasing system featuring a **Node.js/Express REST API**, an **Admin Web Application**, and a **Standalone Tenant Mobile Application (Expo Go)** with integrated **PayMongo Online Payments**.

The tenant mobile app includes a floating, system-only assistant for stall availability, rent due dates, maintenance reports, applications, announcements, and billing summaries. It uses local system records and does not require an external AI key. See [assistant behavior and setup](server/SYSTEM_ASSISTANT.md).

The tenant directory and dashboard no longer offer manual tenant registration shortcuts. Tenant records are created through the stall application approval workflow; editing existing tenants remains available.

For Vercel website/API deployment, free scheduled billing, private cloud uploads and Supabase Google sign-in, follow [DEPLOYMENT.md](DEPLOYMENT.md). Google OAuth requires an installed mobile build; password login remains available in Expo Go. No cloud deployment or provider activation has been performed by the code changes alone.

Tenant chat includes animated assistant typing and a **Talk to an admin** option. Administrators receive live-agent request alerts and can browse all tenant accounts, read saved conversations, and take over through **Tenant Conversations** or the floating **Tenant messages** panel. Local conversations use `server/data/`; Vercel uses PostgreSQL storage after the deployment migration. Retain the local directory until its conversations have been imported. See the assistant documentation above for API details.

---

## 📁 3-Tier Independent Folder Architecture

```
stallleasingsystem/
│
├── 🗄️ server/          # RESTful API Backend (Node.js, Express, Supabase PostgreSQL, PayMongo Gateway)
├── 💻 webapp/          # Admin & Management Web Portal (React 19, Vite, Recharts, Bootstrap 5)
└── 📱 mobileapp/       # Tenant Standalone Mobile App (Expo Go SDK 57, React Native, React Navigation)
```

---

## 🚀 How to Run Each Platform

### 1. 🗄️ Backend API (`server/`)
The single unified API powering both the Web and Mobile apps.
```bash
cd server
npm install
npm run dev
```
* **Runs at**: `http://localhost:5000`
* **Base API**: `http://localhost:5000/api/v1`

---

### 2. 💻 Admin & Management Web App (`webapp/`)
The comprehensive management web dashboard for Administrators.
```bash
cd webapp
npm install
npm run dev
```
* **Runs at**: `http://localhost:5173`
* **Features**: Stall capacity & QR codes, Tenant directory, Application approval pipeline, PayMongo billing hub, Real-time maintenance management, Advisories, Messaging, and Financial Analytics graphs.

---

### 3. 📱 Tenant Mobile App (`mobileapp/`)
The dedicated self-service mobile application for stall tenants and applicants running on **Expo Go**.
```bash
cd mobileapp
npm install
npm start
```
* **How to test on your phone**:
  1. Install **Expo Go** from the Apple App Store or Google Play Store on your phone.
  2. Ensure your phone and computer are on the **same Wi-Fi network**.
  3. Open the **Camera app** (iOS) or **Expo Go scan tool** (Android) and scan the terminal QR code!
* Sign in with an actual registered tenant account. No demo tenant password is provided for the live database.
* This machine uses dependencies and caches on D: because C: was full. See [mobile setup](mobileapp/README.md) before moving the project to another computer.

---

## 🛡️ OWASP Top 10 Security Implementation

* **A01: Broken Access Control**: Strict role-based access control (administrator and tenant roles) with tenant-level data isolation.
* **A02: Cryptographic Failures**: Bcrypt password hashing (10 rounds) + signed JWT authentication with expiration.
* **A03: Injection**: Parameterized SQL values (`$1, $2...`) across all models.
* **A05: Security Misconfiguration**: Helmet.js security headers, CORS origin filtering, sanitized error diagnostics.
* **A07: Identification & Auth Failures**: Sliding-window rate limiter on auth routes to block brute-force attacks.
* **A08: Software & Data Integrity**: Direct PayMongo server-to-server verification for all payment checkout sessions.

## Handover verification

See [the current QA report](qa/QA_REPORT.md) for verified fixes and remaining device/provider checks. The localhost/Expo Go commands above are for development on the same Wi-Fi; they are not a hosted production deployment.

### Automatic billing and PayMongo setup

Lease-anniversary billing is now automatic while the server runs. Apply the recurring-billing migration after the daily/cash migration on each deployment. Online payment uses hosted checkout and verified webhooks; merchant activation and public HTTPS hosting are still required. See [payment deployment instructions](server/PAYMENTS_SETUP.md) and the [latest QA report](qa/QA_REPORT.md).

### Administrator sign-in

The website uses an active administrator in PostgreSQL and opens with empty login fields. Fresh schemas do not install shared administrator credentials. From `server`, set `ADMIN_EMAIL` and optionally `ADMIN_NAME`, then run `node scripts/provision-admin.cjs`. The script generates a password, stores its bcrypt hash and prints the credential once for the operator. Existing admin passwords change only when explicitly run with `--reset-password`. Never commit generated credentials.
