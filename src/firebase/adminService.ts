import { collection, doc, getDocs, updateDoc, query, orderBy, onSnapshot, collectionGroup, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { User, UserRole } from '@/types';

// ─────────────────────────────────────────────────────────────────
//  FETCH ALL EMPLOYEES
// ─────────────────────────────────────────────────────────────────
export async function fetchAllEmployees(): Promise<User[]> {
  const employeesRef = collectionGroup(db, 'profiles');
  const q = query(employeesRef, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  const users: User[] = [];
  
  snapshot.forEach((docSnap) => {
    users.push({ uid: docSnap.id, ...docSnap.data() } as User);
  });
  
  return users;
}

export function subscribeToAllEmployees(callback: (users: User[]) => void): () => void {
  const employeesRef = collectionGroup(db, 'profiles');
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
  // We must find the current role first
  const roles = ['employee', 'project_manager', 'project_coordinator', 'hr_manager', 'administrator', 'finance'];
  let currentRole = null;
  let oldRef = null;
  
  for (const role of roles) {
    const snap = await getDoc(doc(db, 'users', role, 'profiles', uid));
    if (snap.exists()) {
      currentRole = role;
      oldRef = snap.ref;
      break;
    }
  }

  if (!oldRef) throw new Error("User profile not found");

  const updatedData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  if (data.role && data.role !== currentRole) {
    // Move profile document to new role folder
    const newRef = doc(db, 'users', data.role, 'profiles', uid);
    const snap = await getDoc(oldRef);
    await setDoc(newRef, { ...snap.data(), ...updatedData });
    await deleteDoc(oldRef);
  } else {
    await updateDoc(oldRef, updatedData);
  }
}

// ─────────────────────────────────────────────────────────────────
//  CREATE EMPLOYEE BY ADMIN
//  Uses a secondary Firebase app to avoid logging out the Admin
// ─────────────────────────────────────────────────────────────────
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
// setDoc already imported above
import { firebaseConfig } from '@/firebase/config';

export async function createEmployeeByAdmin(params: {
  fullName: string;
  email: string;
  username: string;
  phone: string;
  role: UserRole;
  password?: string;
  dateOfBirth?: string;
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
  await setDoc(doc(db, 'users', params.role, 'profiles', firebaseUser.uid), {
    email: params.email.trim(),
    username: params.username.toLowerCase().trim(),
    phoneNumber: params.phone || null,
    displayName: params.fullName.trim(),
    role: params.role,
    dateOfBirth: params.dateOfBirth || null,
    isActive: true, // Created by admin, so it's active by default
    createdAt: now,
    updatedAt: now,
  });

  // Secondary auth automatically signs the user in on the secondary instance.
  // The main app's auth state remains unchanged (Admin stays logged in).
  await secondaryAuth.signOut();
}
