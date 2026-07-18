/**
 * ─────────────────────────────────────────────────────────────────
 *  FILE: src/firebase/crashLogger.ts
 *  PURPOSE: Remote crash & error logging to Firestore.
 *           Captures fatal crashes, JS errors, and unhandled
 *           promise rejections — no USB/WiFi ADB needed.
 *
 *  Firestore Collection: crash_logs/{autoId}
 * ─────────────────────────────────────────────────────────────────
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── Types ───────────────────────────────────────────────────────
interface CrashLog {
  message: string;
  stack: string;
  isFatal: boolean;
  type: 'js_error' | 'unhandled_promise' | 'global_error' | 'manual';
  platform: string;
  platformVersion: string | number;
  appVersion: string;
  expoVersion: string;
  userId: string | null;
  userEmail: string | null;
  timestamp: string;
  sessionId: string;
  extra?: Record<string, any>;
}

// ─── Session ID (unique per app launch) ──────────────────────────
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Get current user safely (no import cycle) ───────────────────
function getCurrentUser(): { uid: string | null; email: string | null } {
  try {
    // Dynamic require to avoid circular dependency at module load time
    const { useAuthStore } = require('@/store/authStore');
    const user = useAuthStore.getState().user;
    return { uid: user?.uid ?? null, email: user?.email ?? null };
  } catch {
    return { uid: null, email: null };
  }
}

// ─── Core log function ───────────────────────────────────────────
export async function logCrashToFirestore(
  error: any,
  type: CrashLog['type'] = 'js_error',
  isFatal: boolean = false,
  extra?: Record<string, any>
): Promise<void> {
  try {
    const message: string =
      error?.message || (typeof error === 'string' ? error : JSON.stringify(error)) || 'Unknown error';
    const stack: string = error?.stack || 'No stack trace available';

    const { uid, email } = getCurrentUser();

    const log: CrashLog = {
      message: message.substring(0, 500),
      stack: stack.substring(0, 2000),
      isFatal,
      type,
      platform: Platform.OS,
      platformVersion: Platform.Version ?? 'unknown',
      appVersion: Constants.expoConfig?.version ?? '?',
      expoVersion: Constants.expoVersion ?? '?',
      userId: uid,
      userEmail: email,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
      ...(extra ? { extra } : {}),
    };

    // Use dynamic require so this module can be imported before Firebase
    // is fully initialized — we only call Firestore at the moment of logging.
    const { getApps, initializeApp } = require('firebase/app');
    const { getFirestore, collection, addDoc } = require('firebase/firestore');

    const apps = getApps();
    if (apps.length === 0) {
      // Firebase not initialized yet — queue and retry once
      setTimeout(() => logCrashToFirestore(error, type, isFatal, extra), 3000);
      return;
    }

    const db = getFirestore(apps[0]);
    await addDoc(collection(db, 'crash_logs'), log);
  } catch (loggingError) {
    // Silently fail — never let crash logger itself crash the app
    console.warn('[CrashLogger] Failed to log to Firestore:', loggingError);
  }
}

// ─── Setup all global error handlers ─────────────────────────────
export function setupCrashLogging(): void {
  // 1. Global JS error handler (fatal & non-fatal)
  const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();

  (global as any).ErrorUtils?.setGlobalHandler((error: any, isFatal: boolean) => {
    logCrashToFirestore(error, 'global_error', isFatal);

    // Call original handler so React Native's red screen / error boundary still works
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // 2. Unhandled Promise Rejections
  const originalPromiseHandler = (global as any).onunhandledrejection;

  (global as any).onunhandledrejection = (event: any) => {
    const reason = event?.reason ?? event;
    logCrashToFirestore(reason, 'unhandled_promise', false);

    if (originalPromiseHandler) {
      originalPromiseHandler(event);
    }
  };

  // Also hook into the React Native promise rejection tracker
  if ((global as any).HermesInternal) {
    // Hermes engine exposes this
    const tracking = require('promise/setimmediate/rejection-tracking');
    if (tracking?.enable) {
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, error: any) => {
          logCrashToFirestore(error, 'unhandled_promise', false);
        },
      });
    }
  }

  console.log('[CrashLogger] Remote crash logging initialized. Session:', SESSION_ID);
}
