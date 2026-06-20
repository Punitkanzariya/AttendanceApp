import { collection, doc, getDocs, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { User, UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────
//  FETCH ALL EMPLOYEES
// ─────────────────────────────────────────────────────────────────
export async function fetchAllEmployees(): Promise<User[]> {
  const employeesRef = collection(db, 'employees');
  const q = query(employeesRef, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  const users: User[] = [];
  
  snapshot.forEach((docSnap) => {
    users.push({ uid: docSnap.id, ...docSnap.data() } as User);
  });
  
  return users;
}

export function subscribeToAllEmployees(callback: (users: User[]) => void): () => void {
  const employeesRef = collection(db, 'employees');
  const q = query(employeesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const users: User[] = [];
    snapshot.forEach((docSnap) => {
      users.push({ uid: docSnap.id, ...docSnap.data() } as User);
    });
    callback(users);
  }, (error) => {
    console.error('Error subscribing to employees:', error);
  });
}

// ─────────────────────────────────────────────────────────────────
//  UPDATE EMPLOYEE STATUS / ROLE
// ─────────────────────────────────────────────────────────────────
export async function updateEmployeeProfile(
  uid: string,
  data: Partial<Omit<User, 'uid' | 'email' | 'createdAt'>>
): Promise<void> {
  const userRef = doc(db, 'employees', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────
//  CREATE EMPLOYEE BY ADMIN
//  Uses a secondary Firebase app to avoid logging out the Admin
// ─────────────────────────────────────────────────────────────────
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { firebaseConfig } from './config';

export async function createEmployeeByAdmin(params: {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  password?: string;
}): Promise<void> {
  // Create a secondary app specifically for auth operations
  const secondaryApp = getApps().find(app => app.name === 'SecondaryAdminApp') 
    || initializeApp(firebaseConfig, 'SecondaryAdminApp');
  
  const secondaryAuth = getAuth(secondaryApp);

  const defaultPassword = params.password || 'Techsture123!';

  // 1. Create Auth account on the secondary app
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    params.email.trim(),
    defaultPassword
  );

  const firebaseUser = credential.user;

  // 2. Update Auth display name
  await updateProfile(firebaseUser, { displayName: params.fullName.trim() });

  // 3. Save to Firestore using the MAIN app's db
  const now = new Date().toISOString();
  await setDoc(doc(db, 'employees', firebaseUser.uid), {
    email: params.email.toLowerCase().trim(),
    phoneNumber: params.phone || null,
    displayName: params.fullName.trim(),
    role: params.role,
    isActive: true, // Created by admin, so it's active by default
    createdAt: now,
    updatedAt: now,
  });

  // Secondary auth automatically signs the user in on the secondary instance.
  // The main app's auth state remains unchanged (Admin stays logged in).
  await secondaryAuth.signOut();
}
