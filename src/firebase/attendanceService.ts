import { collection, collectionGroup, doc, setDoc, updateDoc, query, where, onSnapshot, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { AttendanceRecord, AttendanceLocation } from '@/types';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// Helper to get local date string YYYY-MM-DD
export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get logical shift date string YYYY-MM-DD
export function getLogicalShiftDate(date = new Date(), shiftStart?: string, shiftEnd?: string): string {
  if (!shiftStart || !shiftEnd) return getLocalDateString(date);

  const [startH, startM] = shiftStart.split(':').map(Number);
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  // If Night Shift
  if (startMins > endMins) {
    const currentMins = date.getHours() * 60 + date.getMinutes();
    // Cut-off at 12:00 PM (Noon) = 720 mins
    if (currentMins < 720) {
      // Logical date is yesterday
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      return getLocalDateString(yesterday);
    }
  }

  // Day shift or after noon for Night shift
  return getLocalDateString(date);
}

// Helper to check if it's late (after shift start + 15 min grace period)
export function checkIsLate(date = new Date(), shiftStart?: string): boolean {
  if (!shiftStart) {
    // Fallback to 09:30 AM if no shift defined
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours > 9) return true;
    if (hours === 9 && minutes > 30) return true;
    return false;
  }
  
  const [shiftHour, shiftMinute] = shiftStart.split(':').map(Number);
  const shiftTimeInMinutes = shiftHour * 60 + shiftMinute;
  const currentTimeInMinutes = date.getHours() * 60 + date.getMinutes();
  
  const GRACE_PERIOD_MINS = 15;
  return currentTimeInMinutes > (shiftTimeInMinutes + GRACE_PERIOD_MINS);
}

export function subscribeToTodayAttendance(
  employeeId: string,
  role: string,
  callback: (record: AttendanceRecord | null) => void,
  shiftStart?: string,
  shiftEnd?: string
): () => void {
  const logicalDateStr = getLogicalShiftDate(new Date(), shiftStart, shiftEnd);
  const docId = `${employeeId}_${logicalDateStr}`;
  const docRef = doc(db, 'attendences', docId);

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
  location: AttendanceLocation | null,
  remark?: string,
  selfieUri?: string | null,
  employeeEmail?: string | null,
  shiftStart?: string,
  shiftEnd?: string,
  shiftName?: string
): Promise<void> {
  const logicalDateStr = getLogicalShiftDate(new Date(), shiftStart, shiftEnd);
  const docId = `${employeeId}_${logicalDateStr}`;
  const docRef = doc(db, 'attendences', docId);
  const now = new Date();
  const nowIso = now.toISOString();

  const isLate = checkIsLate(now, shiftStart);
  const status = isLate ? 'late' : 'present';

  const deviceInfo = `${Platform.OS} ${Platform.Version || ''}`;

  let selfieUrl = null;
  if (selfieUri) {
    selfieUrl = await uploadImageToStorage(selfieUri, `attendance/${employeeId}/${logicalDateStr}_checkin.jpg`);
  }

  const attendanceData: Omit<AttendanceRecord, 'id'> = {
    employeeId,
    dateStr: logicalDateStr,
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
    updatedAt: nowIso,
  };

  if (shiftStart && shiftEnd) {
    attendanceData.shift = { name: shiftName || 'General', startTime: shiftStart, endTime: shiftEnd };
  }

  await setDoc(docRef, attendanceData);
}

export async function checkOutEmployee(
  employeeId: string,
  location: AttendanceLocation | null,
  remark?: string,
  selfieUri?: string | null,
  shiftStart?: string,
  shiftEnd?: string
): Promise<void> {
  // Use logical shift date (same as check-in) to find the correct document
  const logicalDateStr = getLogicalShiftDate(new Date(), shiftStart, shiftEnd);
  const docId = `${employeeId}_${logicalDateStr}`;
  const docRef = doc(db, 'attendences', docId);
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
    selfieUrl = await uploadImageToStorage(selfieUri, `attendance/${employeeId}/${logicalDateStr}_checkout.jpg`);
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
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const attendanceRef = collection(db, 'attendences');
  const q = query(attendanceRef, where('employeeId', '==', employeeId));

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
  const attendanceRef = collection(db, 'attendences');
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

export async function logFailedGeofenceAttempt(
  employeeId: string, 
  employeeName: string, 
  projectId: string, 
  action: string,
  distance: number
) {
  const approvers: string[] = [];
  
  if (projectId) {
    const projSnap = await getDoc(doc(db, 'projects', projectId));
    if (projSnap.exists()) {
      const projData = projSnap.data();
      if (projData.coordinatorId && !approvers.includes(projData.coordinatorId)) {
        approvers.push(projData.coordinatorId);
      }
      if (projData.managerId && !approvers.includes(projData.managerId)) {
        approvers.push(projData.managerId);
      }
    }
  }

  const usersRef = collection(db, 'users');
  const adminQuery = query(usersRef, where('role', '==', 'admin'));
  const adminSnap = await getDocs(adminQuery);
  adminSnap.forEach((docItem) => {
    if (!approvers.includes(docItem.id)) approvers.push(docItem.id);
  });

  const message = `${employeeName} attempted to ${action} but was blocked by geofencing (${Math.round(distance)}m away).`;

  for (const approverId of approvers) {
    const newNotifRef = doc(collection(db, 'notifications', approverId, 'items'));
    try {
      await setDoc(newNotifRef, {
        notifId: newNotifRef.id,
        title: `Geofence Violation Attempt`,
        message,
        type: "warning",
        isRead: false,
        link: "/dashboard/attendance",
        sentBy: employeeId,
        senderName: employeeName,
        receivedBy: approverId,
        isBroadcast: false,
        module: "attendance",
        entityId: `${employeeId}_${getLocalDateString()}`,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to send geofence notification to", approverId, error);
    }
  }
}

export async function markMissedCheckouts(employeeId: string, history: AttendanceRecord[], activeShiftStart?: string, activeShiftEnd?: string): Promise<void> {
  const logicalDateStr = getLogicalShiftDate(new Date(), activeShiftStart, activeShiftEnd);
  const batchUpdates = [];

  for (const record of history) {
    if (record.dateStr !== logicalDateStr && !record.checkOut && !record.missedCheckout) {
      batchUpdates.push(
        updateDoc(doc(db, 'attendences', record.id), {
          missedCheckout: true
        })
      );
    }
  }

  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}
