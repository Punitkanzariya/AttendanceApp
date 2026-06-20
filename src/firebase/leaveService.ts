import { collection, doc, addDoc, updateDoc, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { LeaveRequest, LeaveStatus } from '@/types';

export async function submitLeaveRequest(
  employeeId: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  reason: string
): Promise<void> {
  const leavesRef = collection(db, 'leaves');
  const now = new Date().toISOString();
  
  await addDoc(leavesRef, {
    employeeId,
    employeeName,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

export function subscribeToUserLeaves(
  employeeId: string,
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collection(db, 'leaves');
  const q = query(
    leavesRef, 
    where('employeeId', '==', employeeId)
  );

  return onSnapshot(q, (snapshot) => {
    const leaves: LeaveRequest[] = [];
    snapshot.forEach((docSnap) => {
      leaves.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest);
    });
    // Sort locally to avoid requiring a Firestore composite index
    leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(leaves);
  }, (error) => {
    console.error('Error subscribing to user leaves:', error);
  });
}

export function subscribeToAllLeaves(
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collection(db, 'leaves');
  const q = query(leavesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const leaves: LeaveRequest[] = [];
    snapshot.forEach((docSnap) => {
      leaves.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest);
    });
    callback(leaves);
  }, (error) => {
    console.error('Error subscribing to all leaves:', error);
  });
}

export async function updateLeaveStatus(
  leaveId: string,
  status: LeaveStatus,
  reviewedBy: string,
  reviewNotes?: string
): Promise<void> {
  const leaveRef = doc(db, 'leaves', leaveId);
  await updateDoc(leaveRef, {
    status,
    reviewedBy,
    reviewNotes: reviewNotes || null,
    updatedAt: new Date().toISOString(),
  });
}
