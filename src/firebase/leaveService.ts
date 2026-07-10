import { collection, doc, setDoc, query, onSnapshot, where, getDocs, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { LeaveRequest, Project, LeaveDurationType, HalfDayPeriod, LeaveType, LeaveBalance } from '@/types';

export async function submitLeaveRequest(
  employeeId: string,
  employeeName: string,
  projectId: string,
  type: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  reason: string,
  durationType?: LeaveDurationType,
  halfDayPeriod?: HalfDayPeriod,
  attachmentUrl?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  const approvers: string[] = [];
  
  if (projectId) {
    const projSnap = await getDoc(doc(db, 'projects', projectId));
    if (projSnap.exists()) {
      const projData = projSnap.data() as Project;
      if (projData.coordinatorId && !approvers.includes(projData.coordinatorId)) {
        approvers.push(projData.coordinatorId);
      }
      if (projData.managerId && !approvers.includes(projData.managerId)) {
        approvers.push(projData.managerId);
      }
    }
  }

  if (approvers.length === 0) {
    const usersRef = collection(db, 'users');
    const adminQuery = query(usersRef, where('role', '==', 'admin'));
    const adminSnap = await getDocs(adminQuery);
    adminSnap.forEach(doc => {
      approvers.push(doc.id);
    });
  }

  const leavesRef = doc(collection(db, 'leaves'));
  const requestId = leavesRef.id;
  
  const leaveData: LeaveRequest = {
    requestId,
    employeeId,
    projectId,
    type,
    startDate,
    endDate,
    totalDays,
    durationType,
    reason,
    status: 'pending',
    approvers,
    currentApprovalLevel: 0,
    actionLogs: [
      {
        actionBy: employeeId,
        action: 'submitted',
        timestamp: now
      }
    ]
  };

  if (halfDayPeriod) {
    leaveData.halfDayPeriod = halfDayPeriod;
  }

  if (attachmentUrl) {
    leaveData.attachmentUrl = attachmentUrl;
  }
  
  await setDoc(leavesRef, leaveData as any);

  // Push notification to approvers (Coordinator, Manager, or Admins)
  if (approvers.length > 0) {
    for (const approverId of approvers) {
      const notifRef = collection(db, 'notifications');
      try {
        await addDoc(notifRef, {
          userId: approverId,
          title: "New Leave Request",
          message: `${employeeName} has applied for a leave that requires your approval.`,
          type: "info",
          module: "leave",
          link: "/dashboard/leave/approval-queue",
          isRead: false,
          createdAt: serverTimestamp(),
        });

        // Trigger actual push notification via the Admin Panel's API
        const adminApiUrl = process.env.EXPO_PUBLIC_ADMIN_API_URL;
        if (adminApiUrl) {
          fetch(`${adminApiUrl}/api/notifications/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: approverId,
              payload: {
                title: "New Leave Request",
                message: `${employeeName} has applied for a leave that requires your approval.`,
                module: "leave",
                link: "/dashboard/leave/approval-queue"
              }
            })
          }).catch(err => console.error("Failed to push notification via Admin API", err));
        }
      } catch (error) {
        console.error("Failed to send notification to", approverId, error);
      }
    }
  }
}

export function subscribeToUserLeaves(
  employeeId: string,
  role: string, // Kept for backwards compatibility in calling functions, but unused
  callback: (leaves: LeaveRequest[]) => void
): () => void {
  const leavesRef = collection(db, 'leaves');
  const q = query(leavesRef, where('employeeId', '==', employeeId));

  return onSnapshot(q, (snapshot) => {
    const leaves: LeaveRequest[] = [];
    snapshot.forEach((docSnap) => {
      leaves.push({ ...docSnap.data() } as LeaveRequest);
    });
    
    // Sort locally
    leaves.sort((a, b) => {
      const timeA = a.actionLogs?.[0]?.timestamp ? new Date(a.actionLogs[0].timestamp).getTime() : 0;
      const timeB = b.actionLogs?.[0]?.timestamp ? new Date(b.actionLogs[0].timestamp).getTime() : 0;
      return timeB - timeA;
    });
    callback(leaves);
  }, (error) => {
    console.error('Error subscribing to user leaves:', error);
  });
}

export function subscribeToLeaveTypes(callback: (types: LeaveType[]) => void): () => void {
  const typesRef = collection(db, 'leaveTypes');
  const q = query(typesRef);

  return onSnapshot(q, (snapshot) => {
    const types: LeaveType[] = [];
    snapshot.forEach((docSnap) => {
      types.push({ ...docSnap.data() } as LeaveType);
    });
    callback(types);
  }, (error) => {
    console.error('Error subscribing to leave types:', error);
  });
}

export function subscribeToUserLeaveBalance(
  employeeId: string,
  year: number,
  callback: (balance: LeaveBalance | null) => void
): () => void {
  const leavesRef = collection(db, 'leaveBalances');
  const q = query(leavesRef, where('employeeId', '==', employeeId), where('year', '==', year));

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      callback({ ...snapshot.docs[0].data() } as LeaveBalance);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to leave balance:', error);
  });
}
