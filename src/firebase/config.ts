/**
 * ─────────────────────────────────────────────────────────────────
 *  FILE: src/firebase/config.ts
 *  PURPOSE: Initialize Firebase app + export Auth & Firestore
 *           services for use across the entire application.
 *
 *  HOW IT WORKS:
 *  1. Firebase is initialized ONCE here with our project credentials.
 *  2. We export `auth` (for login/signup/OTP) and `db` (Firestore
 *     for employee, attendance, expense data).
 *  3. Every other file imports from HERE — never call initializeApp()
 *     again anywhere else in the project.
 *
 *  PROJECT: Techsture HRM — AttendanceApp
 *  FIREBASE PROJECT: techsture-hrm
 * ─────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth }      from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage }   from 'firebase/storage';

// ─── Firebase Project Credentials ───────────────────────────────
// These keys are SAFE to include in client-side code.
// Security is enforced by Firebase Security Rules (deny-by-default)
// and Firebase App Check — NOT by hiding these values.
// See: https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey:            'AIzaSyAjB_V7X1MLxZF8r8h7dW8ITaTRBlzBFtA',
  authDomain:        'techsture-hrm.firebaseapp.com',
  projectId:         'techsture-hrm',
  storageBucket:     'techsture-hrm.firebasestorage.app',
  messagingSenderId: '151284434763',
  appId:             '1:151284434763:web:cf2c700500ae68a2fbcace',
};

// ─── Initialize Firebase (only once) ────────────────────────────
// getApps().length check prevents "Firebase App already exists" error
// during Expo hot-reloads and fast-refresh in development.
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ─── Firebase Services ───────────────────────────────────────────
// auth  → handles login, signup, OTP, biometric token validation
// db    → Firestore database (employees, attendance, expenses, etc.)
// storage → Firebase Cloud Storage (expense bill uploads, selfies)

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

export default app;
