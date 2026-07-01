import { collection, collectionGroup, addDoc, updateDoc, doc, onSnapshot, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db, storage } from './config';
import type { ExpenseRequest, ExpenseStatus } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const EXPENSE_COLLECTION = 'expenses'; // Used just for collectionGroup name
const DRAFT_KEY = '@expense_draft';

// --- Firebase Operations ---

export const submitExpenseRequest = async (
  employeeId: string,
  role: string,
  employeeName: string,
  category: string,
  amount: number,
  date: string,
  description: string,
  attachmentUri?: string | null
): Promise<string> => {
  let attachmentUrl = null;

  // Convert attachment and store in Firebase Storage
  if (attachmentUri) {
    try {
      if (Platform.OS === 'web') {
        // On Web, expo-file-system does not work. Fetch the blob and convert to Base64.
        const response = await fetch(attachmentUri);
        const blob = await response.blob();
        const base64Str = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        attachmentUrl = base64Str; // Already contains data:image/... prefix
      } else {
        // Native (Android/iOS)
        const manipResult = await ImageManipulator.manipulateAsync(
          attachmentUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        attachmentUrl = `data:image/jpeg;base64,${base64}`;
      }
    } catch (e) {
      console.error("Error uploading attachment to storage", e);
      throw new Error("Failed to process attachment");
    }
  }

  const now = new Date().toISOString();

  // Find projects this employee is assigned to
  const projectsRef = collection(db, 'projects');
  const projectsSnap = await getDocs(projectsRef);
  
  const projectIds: string[] = [];
  const coordinatorIds: string[] = [];
  const managerIds: string[] = [];

  projectsSnap.forEach((docSnap) => {
    const data = docSnap.data() as any; // Cast as any or Project
    const isAssigned = data.siteEmployees?.some((e: any) => e.employeeId === employeeId);
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

  let initialStatus: ExpenseStatus = 'pending_finance'; // Default if no project
  if (coordinatorIds.length > 0) {
    initialStatus = 'pending_coordinator';
  } else if (managerIds.length > 0) {
    initialStatus = 'pending_manager';
  }
  const expenseData: Omit<ExpenseRequest, 'id'> = {
    employeeId,
    employeeName,
    role,
    category,
    amount,
    date,
    description,
    status: initialStatus,
    attachmentUrl,
    projectIds,
    coordinatorIds,
    managerIds,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, 'users', role, 'profiles', employeeId, EXPENSE_COLLECTION), expenseData);
  
  // Clear draft if successful
  await clearExpenseDraft();

  return docRef.id;
};

export const updateExpenseRequest = async (
  expenseId: string,
  employeeId: string,
  role: string,
  category: string,
  amount: number,
  date: string,
  description: string,
  attachmentUri?: string | null,
  existingAttachmentUrl?: string | null
): Promise<void> => {
  let attachmentUrl = existingAttachmentUrl;

  if (attachmentUri && !attachmentUri.startsWith('http') && !attachmentUri.startsWith('data:image')) {
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(attachmentUri);
        const blob = await response.blob();
        const base64Str = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        attachmentUrl = base64Str;
      } else {
        const manipResult = await ImageManipulator.manipulateAsync(
          attachmentUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        attachmentUrl = `data:image/jpeg;base64,${base64}`;
      }
    } catch (e) {
      console.error("Error uploading attachment to storage", e);
      throw new Error("Failed to process attachment");
    }
  }

  const expenseRef = doc(db, 'users', role, 'profiles', employeeId, EXPENSE_COLLECTION, expenseId);
  await updateDoc(expenseRef, {
    category,
    amount,
    date,
    description,
    status: 'pending_supervisor', // Reset to supervisor if resubmitted
    attachmentUrl,
    updatedAt: new Date().toISOString(),
  });
  
  await clearExpenseDraft();
};

export const subscribeToUserExpenses = (
  employeeId: string,
  role: string,
  onUpdate: (expenses: ExpenseRequest[]) => void
) => {
  const q = query(
    collection(db, 'users', role, 'profiles', employeeId, EXPENSE_COLLECTION)
  );

  return onSnapshot(q, (snapshot) => {
    const expenses: ExpenseRequest[] = [];
    snapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() } as ExpenseRequest);
    });
    
    // Fallback client-side sort
    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    onUpdate(expenses);
  });
};

export const checkDuplicateExpense = async (
  employeeId: string,
  role: string,
  amount: number,
  date: string,
  category: string
): Promise<boolean> => {
  const q = query(
    collection(db, 'users', role, 'profiles', employeeId, EXPENSE_COLLECTION),
    where('date', '==', date),
    where('category', '==', category),
    where('amount', '==', amount)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

// --- Manager/Admin Operations ---

export const subscribeToExpensesForRole = (
  userRole: string,
  userUid: string,
  onUpdate: (expenses: ExpenseRequest[]) => void
) => {
  const q = query(collectionGroup(db, EXPENSE_COLLECTION));

  return onSnapshot(q, (snapshot) => {
    const allExpenses: ExpenseRequest[] = [];
    snapshot.forEach((doc) => {
      allExpenses.push({ id: doc.id, ...doc.data() } as ExpenseRequest);
    });

    const filtered = allExpenses.filter(expense => {
      if (userRole === 'administrator' || userRole === 'finance' || userRole === 'hr_manager') {
        return true; // See all expenses, or rely on client-side status filtering if needed
      }
      if (userRole === 'project_manager') {
        // Show pending_manager expenses assigned to this manager
        if (expense.status === 'pending_manager' && expense.managerIds?.includes(userUid)) return true;
        // Also show expenses they have approved or interacted with
        if (expense.managerIds?.includes(userUid) && (expense.status === 'pending_finance' || expense.status === 'reimbursed' || expense.status === 'rejected')) return true;
        
        // Show if no managerIds were assigned (fallback for old data)
        if (!expense.managerIds || expense.managerIds.length === 0) {
          return expense.status === 'pending_manager' || expense.status === 'pending_finance' || expense.status === 'reimbursed' || expense.status === 'rejected';
        }
        return false;
      }
      if (userRole === 'project_coordinator') {
        // Show pending_coordinator expenses assigned to this coordinator
        if (expense.status === 'pending_coordinator' && expense.coordinatorIds?.includes(userUid)) return true;
        // Also show expenses they interacted with
        if (expense.coordinatorIds?.includes(userUid) && (expense.status === 'pending_manager' || expense.status === 'pending_finance' || expense.status === 'reimbursed' || expense.status === 'rejected')) return true;
        
        // Show if no coordinatorIds were assigned (fallback for old data)
        if (!expense.coordinatorIds || expense.coordinatorIds.length === 0) return true;
        return false;
      }
      return false;
    });

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(filtered);
  });
};

export const subscribeToAllExpenses = (
  statuses: ExpenseStatus[],
  onUpdate: (expenses: ExpenseRequest[]) => void
) => {
  const q = statuses.length > 0
    ? query(collectionGroup(db, EXPENSE_COLLECTION), where('status', 'in', statuses))
    : query(collectionGroup(db, EXPENSE_COLLECTION));

  return onSnapshot(q, (snapshot) => {
    const expenses: ExpenseRequest[] = [];
    snapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() } as ExpenseRequest);
    });
    
    // Fallback client-side sort
    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    onUpdate(expenses);
  });
};

export const updateExpenseStatus = async (
  expenseId: string,
  employeeId: string,
  role: string,
  status: ExpenseStatus,
  reviewerId: string,
  rejectionReason?: string
): Promise<void> => {
  const expenseRef = doc(db, 'users', role, 'profiles', employeeId, EXPENSE_COLLECTION, expenseId);
  const updateData: any = {
    status,
    reviewedBy: reviewerId,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'rejected' && rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  await updateDoc(expenseRef, updateData);
};

// --- Local Draft Operations ---

export const saveExpenseDraft = async (draft: Partial<ExpenseRequest>) => {
  try {
    const jsonValue = JSON.stringify(draft);
    await AsyncStorage.setItem(DRAFT_KEY, jsonValue);
  } catch (e) {
    console.error("Error saving expense draft", e);
  }
};

export const getExpenseDraft = async (): Promise<Partial<ExpenseRequest> | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DRAFT_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch(e) {
    console.error("Error getting expense draft", e);
    return null;
  }
};

export const clearExpenseDraft = async () => {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch(e) {
    console.error("Error clearing expense draft", e);
  }
};

/**
 * Calculates the next appropriate status for an expense request based on the current approving role
 * and the existence of specific roles on the project.
 */
export const getNextExpenseStatus = (expense: ExpenseRequest, currentUserRole: string): ExpenseStatus => {
  if (currentUserRole === 'project_coordinator') {
    return (expense.managerIds && expense.managerIds.length > 0) ? 'pending_manager' : 'pending_finance';
  } else if (currentUserRole === 'project_manager') {
    return 'pending_finance';
  } else if (currentUserRole === 'finance' || currentUserRole === 'administrator') {
    return 'reimbursed';
  }
  return 'reimbursed';
};
