/**
 * ─────────────────────────────────────────────────────────────────
 *  FILE: src/firebase/index.ts
 *  PURPOSE: Central export file for all Firebase services.
 *           Team members import from here — not from individual files.
 *
 *  USAGE EXAMPLES:
 *    import { auth, db, storage }           from '../firebase';
 *    import { loginWithEmail, sendOtp }     from '../firebase';
 *    import { fetchEmployeeProfile }        from '../firebase';
 * ─────────────────────────────────────────────────────────────────
 */

export { auth, db, storage } from './config';
export * from './authService';
export * from './adminService';
