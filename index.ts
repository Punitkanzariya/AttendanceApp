/**
 * ─────────────────────────────────────────────────────────────────
 *  FILE: index.ts
 *  PURPOSE: App entry point.
 *           Sets up remote crash logging FIRST (before anything
 *           else loads) so even startup crashes are captured in
 *           Firestore → crash_logs collection.
 * ─────────────────────────────────────────────────────────────────
 */

import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { setupCrashLogging } from './src/firebase/crashLogger';

// ─── Initialize crash logging BEFORE anything else ───────────────
// This must run first so even Firebase init errors are captured.
setupCrashLogging();

import App from './App';

registerRootComponent(App);
