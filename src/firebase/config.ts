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
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage }   from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Firebase Project Credentials ───────────────────────────────
// These keys are SAFE to include in client-side code.
// Security is enforced by Firebase Security Rules (deny-by-default)
// and Firebase App Check — NOT by hiding these values.
// See: https://firebase.google.com/docs/projects/api-keys
export const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
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

let firebaseAuth;
if (Platform.OS === 'web') {
  // Web uses default getAuth without AsyncStorage
  firebaseAuth = getAuth(app);
} else {
  try {
    // Dynamically require to avoid Web bundler crashes
    const { getReactNativePersistence } = require('firebase/auth');
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (e) {
    // Fallback if missing
    firebaseAuth = getAuth(app);
  }
}

export const auth = firebaseAuth;
export const db      = getFirestore(app);
export const storage = getStorage(app);

export default app;
