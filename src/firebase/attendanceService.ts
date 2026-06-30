import { collection, collectionGroup, doc, setDoc, updateDoc, query, where, onSnapshot, getDoc } from 'firebase/firestore';
import { db, storage } from '@/firebase/config';
import type { AttendanceRecord, AttendanceLocation } from '@/types';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

// Helper to get local date string YYYY-MM-DD
export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to check if it's late (after 09:30 AM)
export function checkIsLate(date = new Date()): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  // 09:30 AM cut-off
  if (hours > 9) return true;
  if (hours === 9 && minutes > 30) return true;
  return false;
}

export function subscribeToTodayAttendance(
  employeeId: string,
  role: string,
  callback: (record: AttendanceRecord | null) => void
): () => void {
  const todayStr = getLocalDateString();
  const docId = `${employeeId}_${todayStr}`;
  const docRef = doc(db, 'users', role, 'profiles', employeeId, 'attendance', docId);

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to today attendance:', error);
  });
}

async function uploadImageToStorage(uri: string, path: string): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    // Instead of Firebase Storage, return the compressed Base64 Data URL.
    // At 600px, the image is ~30KB, well under Firestore's 1MB limit.
    // This bypasses all Storage/Network/Blob errors entirely.
    return `data:image/jpeg;base64,${manipResult.base64}`;
  } catch (e) {
    console.error("Error uploading image to storage", e);
    throw new Error("Failed to process selfie image");
  }
}

export async function checkInEmployee(
  employeeId: string,
  role: string,
  employeeName: string,
  location: AttendanceLocation | null,
  remark?: string,
  selfieUri?: string | null,
  employeeEmail?: string | null
): Promise<void> {
  const todayStr = getLocalDateString();
  const docId = `${employeeId}_${todayStr}`;
  const docRef = doc(db, 'users', role, 'profiles', employeeId, 'attendance', docId);
  const now = new Date();
  const nowIso = now.toISOString();

  const isLate = checkIsLate(now);
  const status = isLate ? 'late' : 'present';

  const deviceInfo = `${Platform.OS} ${Platform.Version || ''}`;

  let selfieUrl = null;
  if (selfieUri) {
    selfieUrl = await uploadImageToStorage(selfieUri, `attendance/${employeeId}/${todayStr}_checkin.jpg`);
  }

  const attendanceData: Omit<AttendanceRecord, 'id'> = {
    employeeId,
    employeeName,
    role,
    employeeEmail: employeeEmail || null,
    dateStr: todayStr,
    checkIn: {
      timestamp: nowIso,
      location,
      remark: remark || '',
      deviceInfo,
      selfieUrl,
    },
    checkOut: null,
    status,
    workingHours: 0,
    verificationStatus: 'pending',
    updatedAt: nowIso,
  };

  await setDoc(docRef, attendanceData);
}

export async function checkOutEmployee(
  employeeId: string,
  role: string,
  location: AttendanceLocation | null,
  remark?: string,
  selfieUri?: string | null
): Promise<void> {
  const todayStr = getLocalDateString();
  const docId = `${employeeId}_${todayStr}`;
  const docRef = doc(db, 'users', role, 'profiles', employeeId, 'attendance', docId);
  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch the check-in doc first to calculate working hours
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('No check-in record found for today');
  }

  const data = docSnap.data();
  const checkInTimestamp = data.checkIn?.timestamp;
  let workingHours = 0;

  if (checkInTimestamp) {
    const checkInTime = new Date(checkInTimestamp).getTime();
    const checkOutTime = now.getTime();
    const diffMs = checkOutTime - checkInTime;
    // Calculate working hours as decimal, e.g., 8.5 hours
    workingHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
  }

  const deviceInfo = `${Platform.OS} ${Platform.Version || ''}`;

  let selfieUrl = null;
  if (selfieUri) {
    selfieUrl = await uploadImageToStorage(selfieUri, `attendance/${employeeId}/${todayStr}_checkout.jpg`);
  }

  await updateDoc(docRef, {
    checkOut: {
      timestamp: nowIso,
      location,
      remark: remark || '',
      deviceInfo,
      selfieUrl,
    },
    workingHours,
    updatedAt: nowIso,
  });
}

export function subscribeToUserAttendanceHistory(
  employeeId: string,
  role: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const attendanceRef = collection(db, 'users', role, 'profiles', employeeId, 'attendance');
  const q = query(attendanceRef); // no need for where('employeeId') since it's user scoped

  return onSnapshot(q, (snapshot) => {
    const history: AttendanceRecord[] = [];
    snapshot.forEach((docSnap) => {
      history.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
    });
    // Sort locally by dateStr descending (most recent first)
    history.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    callback(history);
  }, (error) => {
    console.error('Error subscribing to attendance history:', error);
  });
}

export function subscribeToAllAttendance(
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const attendanceRef = collectionGroup(db, 'attendance');
  const q = query(attendanceRef);

  return onSnapshot(q, (snapshot) => {
    const records: AttendanceRecord[] = [];
    snapshot.forEach((docSnap) => {
      records.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
    });
    // Sort locally by dateStr desc and checkIn timestamp desc
    records.sort((a, b) => {
      const dateCompare = b.dateStr.localeCompare(a.dateStr);
      if (dateCompare !== 0) return dateCompare;
      const timeA = a.checkIn?.timestamp ? new Date(a.checkIn.timestamp).getTime() : 0;
      const timeB = b.checkIn?.timestamp ? new Date(b.checkIn.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    callback(records);
  }, (error) => {
    console.error('Error subscribing to all attendance:', error);
  });
}

export async function updateVerificationStatus(
  attendanceId: string,
  role: string,
  verificationStatus: 'verified' | 'rejected',
  verifiedBy: string
): Promise<void> {
  // Wait, we need employeeId to update verification status. We will extract it from the docId.
  const employeeId = attendanceId.split('_')[0];
  const docRef = doc(db, 'users', role, 'profiles', employeeId, 'attendance', attendanceId);
  await updateDoc(docRef, {
    verificationStatus,
    verifiedBy,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}
