# Product Requirements Document (PRD)
## Employee Attendance & Site Expense Management — Mobile Application

**Version:** 2.0 (React Native / Expo + Firebase)
**Platform:** React Native (Expo) — Android & iOS; Web Admin Portal (Phase-2)
**Backend:** Firebase (Firestore, Authentication, Cloud Functions, Storage, FCM)

---

## 1. Project Overview

### 1.1 Description
A mobile application for employee attendance tracking, leave management, site-based expense submission, and multi-level approval workflows. It enables employees to mark attendance from verified project sites, submit expenses with bills, and allows supervisors/managers/finance to review and approve them.

### 1.2 Target Users & Hierarchy
*   **Administrators:** The highest level of access. They onboard and manage all other roles (Managers, Supervisors, Finance, Employees).
*   **Managers:** Report to Admins. They manage specific teams, approve exceptions, and can onboard Employees under them.
*   **Site Supervisors:** Report to Managers. They manage day-to-day site operations and verify attendance/first-level expenses for their assigned Employees.
*   **Finance Team:** Operates parallel to Managers/Admins, focusing purely on verifying and reimbursing approved expenses.
*   **Employees:** The end-users who report to Supervisors/Managers. They use the app to mark attendance, apply for leave, and submit expenses.

### 1.3 Business Objectives & Metrics
*   **Goals:** Digitize attendance, eliminate manual registers, location-based tracking, simplify expense reimbursement, improve management visibility.
*   **Metrics:** 100% digital attendance, reduced payroll/expense processing time, zero unauthorized data access incidents.

---

## 2. App Architecture & Folder Structure

The project uses a clear, feature-based folder structure to separate concerns, making it easy for humans and AI to understand and navigate.

```text
src/
├── api/             # API client and individual API modules
├── screens/         # UI Screens grouped by feature (auth, attendance, leave, expense, etc.)
├── components/      # Reusable UI components and feature-specific components
├── hooks/           # Custom React hooks (auth, location, network, notifications)
├── services/        # Business logic and external service integrations
├── store/           # State management (Zustand)
├── validations/     # Zod/Yup validation schemas for forms and API payloads
├── navigation/      # React Navigation setup and role-based navigators
├── firebase/        # Firebase configuration and service wrappers
├── utils/           # Helper functions, formatters, and constants
├── types/           # TypeScript interfaces and types
├── assets/          # Images, fonts, etc.
└── config/          # Environment variables and global config
```

---

## 3. Core Modules & Features

### 3.1 Authentication & Security
*   **Login Options:** Mobile OTP (Firebase Phone Auth) and Email/Password.
*   **Biometric Login:** Supported for faster access after initial login.
*   **Session Management:** Secure token storage, ID token auto-refresh.
*   **Account Protection:**
    *   **Account Lock:** After 5 failed attempts within 15 mins.
    *   **Rate Limiting:** OTP resend cooldown (30s) and max requests limits.
    *   **Refresh Token Rotation:** To prevent token theft.
    *   **Device Tracking:** Max 2 active devices; admins can view and revoke devices.
    *   **Force Logout:** Ability to remotely log out users or devices.
*   **Data Security:** Firebase App Check, HTTPS enforced, AES-256 encryption for sensitive data (e.g., Bank Details), Firestore Security Rules (deny-by-default).

### 3.2 Attendance Module
*   **Check-In/Out:** Captures GPS, timestamp, and optional selfie.
*   **Geofencing:** Attendance allowed only within the configured site radius.
*   **Security & Anti-Spoofing:**
    *   **Fake GPS / Mock Location Detection:** Prevents spoofing attendance locations.
*   **Edge Cases & Exception Handling:**
    *   **Missed Checkout Request:** System auto-closes at midnight; employee submits a reason for supervisor approval.
    *   **Attendance Correction Request:** Employees can request manual corrections for anomalies.
    *   **Multiple Site Assignment:** Employees can be assigned to multiple sites simultaneously.
*   **History:** Employees can view daily/monthly history and working hours.

### 3.3 Site Management
*   **Site Master:** Manages site name, coordinates, manager, and working hours.
*   **Dynamic Site Radius:** Geofence radius can be configured dynamically per site by the Admin.

### 3.4 Expense Module
*   **Submission:** Submit expenses with date, category, amount, description, and bill upload (JPG/PNG/PDF).
*   **Enhancements:**
    *   **Draft Save:** Save incomplete expenses locally.
    *   **Duplicate Bill Detection:** Soft warning if similar amount/date/category is submitted within 24 hours.
    *   **Resubmit After Rejection:** Rejected expenses return to draft state with rejection reasons attached.
*   **Workflow:** Employee → Supervisor → Manager → Finance (Reimbursement).

### 3.5 Leave Management
*   **Leave Types:** Casual, Sick, Earned, Unpaid. (Configurable via Admin: **Dynamic Leave Types**).
*   **Workflow:** Employee → Supervisor → Manager. Includes cancellation options.
*   **Conflict Resolution:** Blocks check-ins on approved leave days (with override options).

### 3.6 Notifications
*   Push notifications and a persistent In-App Notification Center.
*   Alerts for attendance reminders, approvals, rejections.

### 3.7 Document Upload
*   **Supported Formats:** JPG, PNG, PDF
*   **Storage:** Firebase Cloud Storage
*   **Maximum File Size:** 10 MB per file (enforced client-side before upload).

---

## 4. Admin & System Settings

Administrators have granular control over the platform:
*   **Dynamic Roles & Permission Matrix:** Create custom roles and dynamically assign module-level permissions (Create, View, Edit, Delete, Approve).
*   **Dynamic Expense Categories:** Add/remove expense categories without app updates.
*   **Dynamic Leave Types:** Configure leave types, quotas, and carry-forward rules.
*   **Dynamic Site Radius:** Adjust geofence sizes per site.

---

## 5. App Features (Non-Functional)

*   **Offline Capability & Queue:** Local SQLite storage for attendance/expenses when offline. Auto-syncs on network reconnect.
*   **Dark Mode:** Full UI support for light and dark themes.
*   **App Versioning & Updates:**
    *   **Force Update:** Block older app versions from accessing the backend.
    *   **OTA Updates:** Using Expo Updates for minor fixes.
*   **Monitoring & Analytics:**
    *   **Crash Reporting:** Integration (e.g., Sentry/Crashlytics) for monitoring app stability.
    *   **Analytics:** Tracking user flows and feature usage.
*   **Audit Trail:** Append-only logs tracking logins, data changes, and approvals.

---

## 6. Database Schema (Firestore Summary)
*   `Employees`: Profile, role, assigned sites, encrypted bank details, device tracking.
*   `Attendance`: Check-in/out timestamps, location, status, regularization requests.
*   `Sites`: Address, coordinates, dynamic radius, working hours.
*   `Expenses`: Details, bill URLs, dynamic status, partial approval history.
*   `Leaves` & `LeaveBalances`: Tracking requests and quotas.
*   `AuditLogs`: User, action, module, timestamp, IP.

---

## 7. API Layer (Cloud Functions)
*   **Callable Functions:** For secure actions like `checkIn`, `applyLeave`, `approveExpense`. Re-validates roles and ownership server-side.
*   **Scheduled Functions:** Nightly auto-checkout, monthly leave accrual, database backups.
*   **Triggers:** Push notifications and audit log generation on data changes.

---

## 8. Future Enhancements (Phase-2)
*(Note: Phase-2 features are currently out of scope for the v1 release and are documented here as future thoughts.)*
*   Payroll & Power BI Dashboard Integration
*   Face Recognition / QR Code Attendance
*   Vehicle Log Book & Asset Management
*   Full Web Admin Portal

---

## 9. Deliverables
1.  React Native (Expo) Android App
2.  React Native (Expo) iOS App
3.  Firebase Backend (Auth, Firestore, Storage, Functions, FCM)
4.  PDF & Excel Reports Generation
5.  Source Code Repository
6.  Deployment Documentation
7.  User Manual
8.  API Documentation
