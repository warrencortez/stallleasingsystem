# 🏪 Commercial Stall Leasing Management System

A multi-platform Commercial Stall Leasing Management & Billing System featuring a **Node.js/Express REST API**, an **Admin Web Application**, and a **Standalone Tenant Mobile Application (Expo Go)** with integrated **PayMongo Online Payments**.

---

## 📁 3-Tier Independent Folder Architecture

```
stallleasingsystem/
│
├── 🗄️ server/          # RESTful API Backend (Node.js, Express, Supabase PostgreSQL, PayMongo Gateway)
├── 💻 webapp/          # Admin & Management Web Portal (React 19, Vite, Recharts, Bootstrap 5)
└── 📱 mobileapp/       # Tenant Standalone Mobile App (Expo Go SDK 52, React Native, React Navigation)
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
The comprehensive management web dashboard for Administrators and Staff.
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
npx expo start
```
* **How to test on your phone**:
  1. Install **Expo Go** from the Apple App Store or Google Play Store on your phone.
  2. Ensure your phone and computer are on the **same Wi-Fi network**.
  3. Open the **Camera app** (iOS) or **Expo Go scan tool** (Android) and scan the terminal QR code!
* **Demo Tenant Login**:
  * **Email**: `maria@stalllease.com`
  * **Password**: `tenant123`

---

## 🛡️ OWASP Top 10 Security Implementation

* **A01: Broken Access Control**: Strict role-based access control (`authorize('admin', 'staff', 'tenant')`) with tenant-level data isolation.
* **A02: Cryptographic Failures**: Bcrypt password hashing (10 rounds) + signed JWT authentication with expiration.
* **A03: Injection**: 100% Parameterized SQL prepared queries (`$1, $2...`) across all models.
* **A05: Security Misconfiguration**: Helmet.js security headers, CORS origin filtering, sanitized error diagnostics.
* **A07: Identification & Auth Failures**: Sliding-window rate limiter on auth routes to block brute-force attacks.
* **A08: Software & Data Integrity**: Direct PayMongo server-to-server verification for all payment checkout sessions.
