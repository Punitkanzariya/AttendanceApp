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
  collection,
  query,
  where,
  getDocs,
  limit,
  collectionGroup,
  onSnapshot,
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
    // 1. Fetch flat user document from new admin schema
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    
    if (!snap.exists()) {
      // Fallback: Check old schema just in case the DB isn't fully migrated
      const roles = ['employee', 'project_manager', 'project_coordinator', 'hr_manager', 'administrator', 'finance'];
      const promises = roles.map(role => getDoc(doc(db, 'users', role, 'profiles', uid)));
      const snaps = await Promise.all(promises);
      const oldSnap = snaps.find(s => s.exists());
      
      if (!oldSnap) return null;
      
      const oldData = oldSnap.data();
      return {
        uid,
        email:       oldData.email       ?? '',
        username:    oldData.username    ?? '',
        phoneNumber: oldData.phoneNumber ?? null,
        displayName: oldData.displayName ?? null,
        role:        (oldData.role as UserRole) ?? 'employee',
        siteId:      oldData.siteId,
        managerId:   oldData.managerId,
        leaveBalances: oldData.leaveBalances,
        createdAt:   oldData.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        isActive:    oldData.isActive ?? true,
      };
    }

    const data = snap.data();
    
    // 2. Fetch the dynamic role if roleId is present
    let roleData = undefined;
    if (data.roleId) {
      const roleDoc = await getDoc(doc(db, 'roles', data.roleId));
      if (roleDoc.exists()) {
        roleData = roleDoc.data();
      }
    }

    return {
      uid,
      email:       data.email       ?? '',
      username:    data.username    ?? '',
      phoneNumber: data.phone ?? (data.phoneNumber ?? null),
      displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || null,
      roleId:      data.roleId,
      roleData:    roleData as any,
      role:        data.role ?? 'employee', // legacy fallback string
      
      // Additional Admin Panel fields
      employeeId:  data.employeeId,
      firstName:   data.firstName,
      lastName:    data.lastName,
      designation: data.designation,
      department:  data.department,
      projectId:   data.projectId,
      joinDate:    data.joinDate,
      dateOfBirth: data.dateOfBirth,
      status:      data.status,
      profilePicture: data.profilePicture || null,
      currentReportingManagerId: data.currentReportingManagerId,
      
      siteId:      data.siteId,
      managerId:   data.managerId,
      leaveBalances: data.leaveBalances,
      createdAt:   data.createdAt ?? new Date().toISOString(),
      isActive:    data.isActive ?? true,
    };
  } catch (error) {
    console.error('[authService] fetchEmployeeProfile error:', error);
    return null;
  }
}

/**
 * Subscribe to the employee's profile in real-time.
 * If the role or status changes, this will trigger the callback with the new data.
 */
export function subscribeToEmployeeProfile(
  uid: string,
  role: string,
  callback: (user: User | null) => void
): () => void {
  const docRef = doc(db, 'users', uid);
  return onSnapshot(
    docRef,
    async (snap: any) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data();
      
      let roleData = undefined;
      if (data.roleId) {
        const roleSnap = await getDoc(doc(db, 'roles', data.roleId));
        if (roleSnap.exists()) {
          roleData = roleSnap.data();
        }
      }

      callback({
        uid,
        email:       data.email       ?? '',
        username:    data.username    ?? '',
        phoneNumber: data.phone ?? (data.phoneNumber ?? null),
        displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || null,
        roleId:      data.roleId,
        roleData:    roleData as any,
        role:        data.role ?? 'employee',
        
        // Additional Admin Panel fields
        employeeId:  data.employeeId,
        firstName:   data.firstName,
        lastName:    data.lastName,
        designation: data.designation,
        department:  data.department,
        projectId:   data.projectId,
        joinDate:    data.joinDate,
        dateOfBirth: data.dateOfBirth,
        status:      data.status,
        profilePicture: data.profilePicture || null,
        currentReportingManagerId: data.currentReportingManagerId,
        
        siteId:      data.siteId,
        managerId:   data.managerId,
        leaveBalances: data.leaveBalances,
        createdAt:   data.createdAt ?? new Date().toISOString(),
        isActive:    data.isActive ?? true,
      });
    },
    (error: any) => {
      console.error('[authService] subscribeToEmployeeProfile error:', error);
    }
  );
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
//  RESOLVE USERNAME TO EMAIL
//  Queries Firestore to find the real email for a given username.
// ─────────────────────────────────────────────────────────────────
export async function resolveUsernameToEmail(input: string): Promise<string | null> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  if (isEmail) return input;

  // Search the flat 'users' collection (Admin panel structure)
  const q = query(
    collection(db, 'users'),
    where('username', '==', input.toLowerCase()),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return snapshot.docs[0].data().email || null;
}

// ─────────────────────────────────────────────────────────────────
//  CHECK IF PHONE NUMBER EXISTS
//  Queries Firestore to check if a mobile number is registered.
// ─────────────────────────────────────────────────────────────────
export async function checkIfPhoneExists(phoneNumber: string): Promise<boolean> {
  const usersRef = collectionGroup(db, 'profiles');
  
  // Try exact match
  let q = query(usersRef, where('phoneNumber', '==', phoneNumber));
  let snapshot = await getDocs(q);
  if (!snapshot.empty) return true;

  // If not found and it's an Indian number, try without +91
  if (phoneNumber.startsWith('+91')) {
    const localNumber = phoneNumber.slice(3);
    q = query(usersRef, where('phoneNumber', '==', localNumber));
    snapshot = await getDocs(q);
    if (!snapshot.empty) return true;
  }

  return false;
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

    // 4.1 Enforce Employee-Only Login
    if (profile?.roleData) {
      const roleName = profile.roleData.name?.toLowerCase();
      if (roleName !== 'employee') {
        await signOut(auth); // Sign out the Firebase user immediately
        throw new Error('ACCESS_DENIED: Only employees are allowed to use this mobile app.');
      }
    }

    if (!profile) {
      // Auto-repair missing Firestore profile (e.g. if previous write failed)
      const now = new Date().toISOString();
      const repairDoc = {
        email: email.trim(),
        username: email.split('@')[0].toLowerCase().trim(),
        phoneNumber: null,
        displayName: email.split('@')[0], // Fallback name
        role: 'employee',
        isActive: false, // Default to false
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', firebaseUid), repairDoc);
      profile = { uid: firebaseUid, ...repairDoc } as User;
    }

    return { user: profile, failedAttempts: 0 };

  } catch (error: any) {
    // Don't record attempts for our own custom errors
    if (
      error.message?.startsWith('ACCOUNT_LOCKED') ||
      error.message?.startsWith('ACCESS_DENIED') ||
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
    // Phone user exists in Auth but no Firestore record for this UID.
    // We check if their phone number exists in our profiles collection.
    const usersRef = collectionGroup(db, 'profiles');
    
    // 1. Try exact match (e.g. +919876543210)
    let q = query(usersRef, where('phoneNumber', '==', firebaseUser.phoneNumber));
    let snapshot = await getDocs(q);
    
    // 2. If not found and it's an Indian number, try without +91
    if (snapshot.empty && firebaseUser.phoneNumber?.startsWith('+91')) {
      const localNumber = firebaseUser.phoneNumber.slice(3);
      q = query(usersRef, where('phoneNumber', '==', localNumber));
      snapshot = await getDocs(q);
    }

    if (!snapshot.empty) {
      // User exists in our DB! We use their existing profile data and UID.
      const existingDoc = snapshot.docs[0];
      const data = existingDoc.data();
      
      const existingProfile: User = {
        uid:         existingDoc.id,
        email:       data.email ?? '',
        username:    data.username ?? '',
        phoneNumber: data.phoneNumber ?? null,
        displayName: data.displayName ?? null,
        role:        (data.role as UserRole) ?? 'employee',
        siteId:      data.siteId,
        managerId:   data.managerId,
        createdAt:   data.createdAt ?? new Date().toISOString(),
        isActive:    data.isActive ?? true,
      };

      return existingProfile;
    } else {
      // No user found with this phone number. 
      // Do not create a new account! Sign them out and throw error.
      await signOut(auth);
      throw new Error('User not found. Please ask the Admin to add your mobile number.');
    }
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
    'auth/user-not-found':         'No account found with this username.',
    'auth/wrong-password':         remaining > 0
      ? `Incorrect password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      : 'Incorrect password. Account will be locked.',
    'auth/invalid-credential':     remaining > 0
      ? `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      : 'Invalid username or password. Account will be locked.',
    'auth/invalid-email':          'Please enter a valid username (no spaces allowed).',
    'auth/user-disabled':          'This account has been disabled. Contact your Administrator.',
    'auth/too-many-requests':      'Too many attempts from this device. Try again later.',
    'auth/network-request-failed': 'No internet connection. Check your network and try again.',
    'auth/email-already-in-use':   'An account already exists with this username.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/operation-not-allowed':  'This sign-in method is not enabled. Contact Administrator.',
  };

  return messages[code ?? ''] ?? 'Sign in failed. Please check your credentials and try again.';
}
