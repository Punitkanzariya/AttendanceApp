import { collection, collectionGroup, doc, addDoc, updateDoc, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { LeaveRequest, LeaveStatus } from '@/types';

export async function submitLeaveRequest(
  employeeId: string,
  role: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  reason: string
): Promise<void> {
  const leavesRef = collection(db, 'users', role, 'profiles', employeeId, 'leaves');
  const now = new Date().toISOString();
  
  await addDoc(leavesRef, {
    employeeId,
    employeeName,
    role,
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
  role: string,
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collection(db, 'users', role, 'profiles', employeeId, 'leaves');
  const q = query(leavesRef); // no need for where() since it's user scoped

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
  const leavesRef = collectionGroup(db, 'leaves');
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
  employeeId: string,
  role: string,
  status: LeaveStatus,
  reviewedBy: string,
  reviewNotes?: string
): Promise<void> {
  const leaveRef = doc(db, 'users', role, 'profiles', employeeId, 'leaves', leaveId);
  await updateDoc(leaveRef, {
    status,
    reviewedBy,
    reviewNotes: reviewNotes || null,
    updatedAt: new Date().toISOString(),
  });
}
