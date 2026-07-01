import { collection, collectionGroup, doc, addDoc, updateDoc, query, orderBy, getDocs, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { LeaveRequest, LeaveStatus, Project, LeaveDurationType, HalfDayPeriod } from '@/types';

export async function submitLeaveRequest(
  employeeId: string,
  role: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  reason: string,
  durationType?: LeaveDurationType,
  halfDayPeriod?: HalfDayPeriod
): Promise<void> {
  const now = new Date().toISOString();
  
  // Find projects this employee is assigned to
  const projectsRef = collection(db, 'projects');
  const projectsSnap = await getDocs(projectsRef);
  
  const projectIds: string[] = [];
  const coordinatorIds: string[] = [];
  const managerIds: string[] = [];

  projectsSnap.forEach((docSnap) => {
    const data = docSnap.data() as Project;
    const isAssigned = data.siteEmployees?.some(e => e.employeeId === employeeId);
    if (isAssigned && !data.isClosed) {
      projectIds.push(data.id);
      if (data.projectCoordinatorId && !coordinatorIds.includes(data.projectCoordinatorId)) {
        coordinatorIds.push(data.projectCoordinatorId);
      }
      if (data.projectManagerId && !managerIds.includes(data.projectManagerId)) {
        managerIds.push(data.projectManagerId);
      }
    }
  });

  // Determine initial status based on hierarchy
  let initialStatus: LeaveStatus = 'pending_hr'; // Default if no project/manager
  if (coordinatorIds.length > 0) {
    initialStatus = 'pending_coordinator';
  } else if (managerIds.length > 0) {
    initialStatus = 'pending_manager';
  }

  const leavesRef = collection(db, 'users', role, 'profiles', employeeId, 'leaves');
  
  await addDoc(leavesRef, {
    employeeId,
    employeeName,
    role,
    leaveType,
    durationType: durationType || 'full_day', // fallback if not provided
    halfDayPeriod: halfDayPeriod || null,
    startDate,
    endDate,
    totalDays,
    reason,
    status: initialStatus,
    projectIds,
    coordinatorIds,
    managerIds,
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

export function subscribeToLeavesForRole(
  userRole: string,
  userUid: string,
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collectionGroup(db, 'leaves');
  
  // Notice we sort in JS because collectionGroup + where + orderBy requires many composite indexes
  const q = query(leavesRef);

  return onSnapshot(q, (snapshot) => {
    const allLeaves: LeaveRequest[] = [];
    snapshot.forEach((docSnap) => {
      allLeaves.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest);
    });

    // Filter based on role
    const filtered = allLeaves.filter(leave => {
      if (userRole === 'administrator' || userRole === 'hr_manager') {
        // HR/Admin sees pending_hr, approved, and rejected
        return leave.status === 'pending_hr' || leave.status === 'approved' || leave.status === 'rejected';
      }
      if (userRole === 'project_manager') {
        // Manager sees their pending_manager leaves, or leaves they have already approved (now pending_hr or approved)
        if (leave.status === 'pending_manager' && leave.managerIds?.includes(userUid)) return true;
        // Also show historical leaves they interacted with
        if (leave.managerIds?.includes(userUid) && (leave.status === 'pending_hr' || leave.status === 'approved' || leave.status === 'rejected')) return true;
        return false;
      }
      if (userRole === 'project_coordinator') {
        // Coordinator sees their pending_coordinator leaves
        if (leave.status === 'pending_coordinator' && leave.coordinatorIds?.includes(userUid)) return true;
        // And historical leaves they interacted with
        if (leave.coordinatorIds?.includes(userUid) && (leave.status === 'pending_manager' || leave.status === 'pending_hr' || leave.status === 'approved' || leave.status === 'rejected')) return true;
        return false;
      }
      return false;
    });

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(filtered);
  }, (error) => {
    console.error('Error subscribing to leaves:', error);
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

/**
 * Subscribe to ALL leave requests across all users (no role-based filtering).
 * Used by Reports screens that need the full dataset.
 */
export function subscribeToAllLeaves(
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collectionGroup(db, 'leaves');
  const q = query(leavesRef);

  return onSnapshot(q, (snapshot) => {
    const allLeaves: LeaveRequest[] = [];
    snapshot.forEach((docSnap) => {
      allLeaves.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest);
    });
    allLeaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(allLeaves);
  }, (error) => {
    console.error('Error subscribing to all leaves:', error);
  });
}

/**
 * Calculates the next appropriate status for a leave request based on the current approving role
 * and the existence of specific roles on the project.
 */
export function getNextLeaveStatus(leave: LeaveRequest, currentUserRole: string): LeaveStatus {
  if (currentUserRole === 'project_coordinator') {
    return (leave.managerIds && leave.managerIds.length > 0) ? 'pending_manager' : 'pending_hr';
  } else if (currentUserRole === 'project_manager') {
    return 'pending_hr';
  } else if (currentUserRole === 'hr_manager' || currentUserRole === 'administrator') {
    return 'approved';
  }
  return 'approved';
}
