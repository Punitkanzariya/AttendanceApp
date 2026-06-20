/**
 * ─────────────────────────────────────────────────────────────────
 *  FILE: src/firebase/authService.ts
 *  PURPOSE: All Firebase Authentication logic in ONE place.
 *           Screens call these functions — they never touch Firebase
 *           directly. This keeps screens clean and logic testable.
 *
 *  FUNCTIONS EXPORTED:
 *  • loginWithEmail      → Email + password sign-in (PRD §3.1)
 *  • registerWithEmail   → New account creation
 *  • sendOtp             → Firebase Phone Auth — sends SMS OTP
 *  • verifyOtp           → Confirms OTP entered by user
 *  • sendPasswordReset   → Email reset link
 *  • firebaseLogout      → Sign out current user
 *  • getCurrentFirebaseUser → Reads currently logged-in Firebase user
 *
 *  PRD SECURITY REQUIREMENTS HANDLED HERE:
 *  • Account lock after 5 failed attempts → tracked in Firestore
 *  • Rate limiting → Firebase enforces OTP limits server-side
 *  • Session token → Firebase ID tokens auto-refresh every 1 hour
 * ─────────────────────────────────────────────────────────────────
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  PhoneAuthProvider,
  signInWithCredential,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

import { auth, db } from '@/firebase/config';
import type { User, UserRole } from '@/types';

// ─── Constants (PRD §3.1) ────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;       // Lock account after this many fails
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// ─────────────────────────────────────────────────────────────────
//  AUTH STATE LISTENER
//  Call this once in App.tsx to watch for login/logout events.
//  Firebase automatically restores session after app restart.
// ─────────────────────────────────────────────────────────────────
export function subscribeToAuthState(
  callback: (firebaseUser: FirebaseUser | null) => void
): () => void {
  // Returns an unsubscribe function — call it in useEffect cleanup
  return onAuthStateChanged(auth, callback);
}

// ─────────────────────────────────────────────────────────────────
//  GET EMPLOYEE PROFILE FROM FIRESTORE
//  After Firebase login, we fetch the employee's full profile
//  (role, siteId, displayName, etc.) from Firestore `employees`
//  collection. The role determines which navigator is shown.
// ─────────────────────────────────────────────────────────────────
export async function fetchEmployeeProfile(uid: string): Promise<User | null> {
  try {
    const snap = await getDoc(doc(db, 'employees', uid));
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      uid,
      email:       data.email       ?? null,
      phoneNumber: data.phoneNumber ?? null,
      displayName: data.displayName ?? null,
      role:        (data.role as UserRole) ?? 'employee',
      siteId:      data.siteId,
      managerId:   data.managerId,
      createdAt:   data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      isActive:    data.isActive ?? true,
    };
  } catch (error) {
    console.error('[authService] fetchEmployeeProfile error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
//  CHECK ACCOUNT LOCKOUT (PRD §3.1)
//  Before every login attempt, we check Firestore to see if this
//  account is currently locked. Returns lock info or null.
// ─────────────────────────────────────────────────────────────────
export async function checkAccountLockout(email: string): Promise<{
  isLocked: boolean;
  remainingMs: number;
  failedAttempts: number;
}> {
  try {
    // Use email as the document ID (sanitised: replace @ and . with _)
    const sanitizedEmail = email.toLowerCase().replace(/[@.]/g, '_');
    const lockRef  = doc(db, 'loginAttempts', sanitizedEmail);
    const lockSnap = await getDoc(lockRef);

    if (!lockSnap.exists()) {
      // No record → first time trying, no lockout
      return { isLocked: false, remainingMs: 0, failedAttempts: 0 };
    }

    const data            = lockSnap.data();
    const failedAttempts  = data.failedAttempts ?? 0;
    const lockedUntil     = data.lockedUntil?.toMillis?.() ?? 0;
    const now             = Date.now();

    if (lockedUntil > now) {
      // Still within lockout window
      return {
        isLocked:       true,
        remainingMs:    lockedUntil - now,
        failedAttempts,
      };
    }

    return { isLocked: false, remainingMs: 0, failedAttempts };
  } catch {
    // If Firestore check fails, allow login attempt (fail open)
    return { isLocked: false, remainingMs: 0, failedAttempts: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────
//  RECORD FAILED LOGIN ATTEMPT (PRD §3.1)
//  Called when login fails. Increments counter in Firestore.
//  Locks account if MAX_FAILED_ATTEMPTS is reached.
// ─────────────────────────────────────────────────────────────────
async function recordFailedAttempt(email: string): Promise<number> {
  const sanitizedEmail = email.toLowerCase().replace(/[@.]/g, '_');
  const lockRef = doc(db, 'loginAttempts', sanitizedEmail);
  const snap    = await getDoc(lockRef);

  const currentAttempts = snap.exists() ? (snap.data().failedAttempts ?? 0) : 0;
  const newAttempts     = currentAttempts + 1;

  const updateData: Record<string, any> = {
    failedAttempts: increment(1),
    lastAttemptAt:  serverTimestamp(),
  };

  // Lock if max attempts reached
  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  if (snap.exists()) {
    await updateDoc(lockRef, updateData);
  } else {
    await setDoc(lockRef, { ...updateData, failedAttempts: 1 });
  }

  return newAttempts;
}

// ─────────────────────────────────────────────────────────────────
//  CLEAR FAILED ATTEMPTS (on successful login)
// ─────────────────────────────────────────────────────────────────
async function clearFailedAttempts(email: string): Promise<void> {
  const sanitizedEmail = email.toLowerCase().replace(/[@.]/g, '_');
  const lockRef = doc(db, 'loginAttempts', sanitizedEmail);
  const snap    = await getDoc(lockRef);
  if (snap.exists()) {
    await updateDoc(lockRef, {
      failedAttempts: 0,
      lockedUntil:    null,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
//  LOGIN WITH EMAIL & PASSWORD (PRD §3.1)
//  Returns the app User object (with role from Firestore) on success.
//  Throws a friendly error message on failure.
// ─────────────────────────────────────────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ user: User; failedAttempts: number }> {

  // 1. Check if account is locked before attempting
  const lockStatus = await checkAccountLockout(email);
  if (lockStatus.isLocked) {
    const mins = Math.ceil(lockStatus.remainingMs / 60000);
    throw new Error(`ACCOUNT_LOCKED:${mins}`);
    // The screen reads this prefix to show the lockout UI
  }

  try {
    // 2. Firebase Authentication — throws on wrong credentials
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const firebaseUid = credential.user.uid;

    // 3. Success — clear any previous failed attempts
    await clearFailedAttempts(email);

    // 4. Fetch full employee profile from Firestore
    let profile = await fetchEmployeeProfile(firebaseUid);

    if (!profile) {
      // Auto-repair missing Firestore profile (e.g. if previous write failed)
      const now = new Date().toISOString();
      const repairDoc = {
        email: email.toLowerCase().trim(),
        phoneNumber: null,
        displayName: email.split('@')[0], // Fallback name
        role: 'employee',
        isActive: false, // Default to false
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'employees', firebaseUid), repairDoc);
      profile = { uid: firebaseUid, ...repairDoc } as User;
    }

    return { user: profile, failedAttempts: 0 };

  } catch (error: any) {
    // Don't record attempts for our own custom errors
    if (
      error.message?.startsWith('ACCOUNT_LOCKED') ||
      error.message === 'PROFILE_NOT_FOUND'
    ) {
      throw error;
    }

    // 5. Record failed attempt in Firestore
    const newCount = await recordFailedAttempt(email);

    // 6. Map Firebase error codes to friendly messages
    throw new Error(mapFirebaseAuthError(error.code, newCount));
  }
}

// ─────────────────────────────────────────────────────────────────
//  REGISTER NEW EMPLOYEE (PRD §3.1)
//  Creates Firebase Auth account + Firestore employee document.
//  Role is NOT set here — Admin assigns it later via Admin panel.
// ─────────────────────────────────────────────────────────────────
export async function registerWithEmail(params: {
  fullName:   string;
  email:      string;
  phone:      string;
  password:   string;
  department?: string;
  employeeId?: string;
}): Promise<User> {

  // 1. Create Firebase Auth account
  const credential = await createUserWithEmailAndPassword(
    auth,
    params.email.trim(),
    params.password
  );

  const firebaseUser = credential.user;

  // 2. Update Firebase display name
  await updateProfile(firebaseUser, { displayName: params.fullName.trim() });

  // 3. Create employee document in Firestore
  //    Admin will later update: role, siteId, managerId, isActive
  const now = new Date().toISOString();
  const employeeDoc: Omit<User, 'uid'> & Record<string, any> = {
    email:       params.email.trim(),
    phoneNumber: `+91${params.phone}`,
    displayName: params.fullName.trim(),
    role:        'employee',       // Default — Admin promotes later
    department:  params.department ?? '',
    employeeId:  params.employeeId ?? '',
    isActive:    false,            // Inactive until Admin activates
    createdAt:   now,
    updatedAt:   now,
  };

  await setDoc(doc(db, 'employees', firebaseUser.uid), employeeDoc);

  return {
    uid: firebaseUser.uid,
    ...employeeDoc,
  } as User;
}

// ─────────────────────────────────────────────────────────────────
//  PHONE OTP — SEND (PRD §3.1)
//  Firebase sends an SMS to the user's phone.
//  Returns a ConfirmationResult that is passed to verifyOtp().
//
//  NOTE: For React Native, you need a reCAPTCHA verifier.
//  In Expo Go on a physical device, Firebase handles this
//  automatically via SafetyNet / App Check.
// ─────────────────────────────────────────────────────────────────
export async function sendOtp(
  phoneNumber: string  // Must include country code, e.g. "+919876543210"
): Promise<ConfirmationResult> {
  // PhoneAuthProvider is used differently in React Native vs Web.
  // For full implementation with Expo, use:
  // import { PhoneAuthProvider, signInWithPhoneNumber } from 'firebase/auth';
  // The actual reCAPTCHA / SafetyNet flow is handled by Firebase SDK.

  // TODO: Replace with actual Firebase Phone Auth implementation
  // when connecting to a real device. Expo Go uses test credentials.
  // See: https://docs.expo.dev/versions/v56.0.0/sdk/firebase-recaptcha/
  throw new Error('PHONE_AUTH_TODO: Implement with Firebase Phone Auth + RecaptchaVerifier');
}

// ─────────────────────────────────────────────────────────────────
//  PHONE OTP — VERIFY (PRD §3.1)
//  User enters the 6-digit code. We verify it with Firebase.
//  On success, fetch Firestore profile to get role.
// ─────────────────────────────────────────────────────────────────
export async function verifyOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<User> {
  // Verify the code — throws if wrong
  const credential   = await confirmationResult.confirm(otpCode);
  const firebaseUser = credential.user;

  // Fetch Firestore profile for role & other details
  const profile = await fetchEmployeeProfile(firebaseUser.uid);

  if (!profile) {
    // Phone user exists in Auth but no Firestore record
    // Could be a new user registering via phone
    const newUser: User = {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email ?? null,
      phoneNumber: firebaseUser.phoneNumber ?? null,
      displayName: firebaseUser.displayName ?? 'User',
      role:        'employee',
      isActive:    false,
      createdAt:   new Date().toISOString(),
    };
    // Create basic Firestore record
    await setDoc(doc(db, 'employees', firebaseUser.uid), {
      ...newUser,
      updatedAt: new Date().toISOString(),
    });
    return newUser;
  }

  return profile;
}

// ─────────────────────────────────────────────────────────────────
//  FORGOT PASSWORD (PRD §3.1)
//  Sends a password reset link to the user's email.
// ─────────────────────────────────────────────────────────────────
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// ─────────────────────────────────────────────────────────────────
//  LOGOUT (PRD §3.1 — Force Logout support)
// ─────────────────────────────────────────────────────────────────
export async function firebaseLogout(): Promise<void> {
  await signOut(auth);
}

// ─────────────────────────────────────────────────────────────────
//  GET CURRENT FIREBASE USER
//  Returns the currently signed-in Firebase user, or null.
// ─────────────────────────────────────────────────────────────────
export function getCurrentFirebaseUser(): FirebaseUser | null {
  return auth.currentUser;
}

// ─────────────────────────────────────────────────────────────────
//  MAP FIREBASE ERROR CODES TO FRIENDLY MESSAGES
//  Full list: https://firebase.google.com/docs/auth/admin/errors
// ─────────────────────────────────────────────────────────────────
function mapFirebaseAuthError(code: string | undefined, attempts: number): string {
  const remaining = MAX_FAILED_ATTEMPTS - attempts;

  const messages: Record<string, string> = {
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         remaining > 0
      ? `Incorrect password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      : 'Incorrect password. Account will be locked.',
    'auth/invalid-credential':     remaining > 0
      ? `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      : 'Invalid credentials. Account will be locked.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-disabled':          'This account has been disabled. Contact your Administrator.',
    'auth/too-many-requests':      'Too many attempts from this device. Try again later.',
    'auth/network-request-failed': 'No internet connection. Check your network and try again.',
    'auth/email-already-in-use':   'An account already exists with this email address.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/operation-not-allowed':  'This sign-in method is not enabled. Contact Administrator.',
  };

  return messages[code ?? ''] ?? 'Sign in failed. Please check your credentials and try again.';
}
