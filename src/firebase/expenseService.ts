import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db, storage } from './config';
import type { ExpenseRequest, ExpenseStatus } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const EXPENSE_COLLECTION = 'Expenses';
const DRAFT_KEY = '@expense_draft';

// --- Firebase Operations ---

export const submitExpenseRequest = async (
  employeeId: string,
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
  
  const expenseData: Omit<ExpenseRequest, 'id'> = {
    employeeId,
    employeeName,
    category,
    amount,
    date,
    description,
    status: 'pending_supervisor',
    attachmentUrl,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), expenseData);
  
  // Clear draft if successful
  await clearExpenseDraft();

  return docRef.id;
};

export const updateExpenseRequest = async (
  expenseId: string,
  employeeId: string,
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

  const expenseRef = doc(db, EXPENSE_COLLECTION, expenseId);
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
  onUpdate: (expenses: ExpenseRequest[]) => void
) => {
  const q = query(
    collection(db, EXPENSE_COLLECTION),
    where('employeeId', '==', employeeId)
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
  amount: number,
  date: string,
  category: string
): Promise<boolean> => {
  const q = query(
    collection(db, EXPENSE_COLLECTION),
    where('employeeId', '==', employeeId),
    where('date', '==', date),
    where('category', '==', category),
    where('amount', '==', amount)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

// --- Manager/Admin Operations ---

export const subscribeToAllExpenses = (
  statuses: ExpenseStatus[],
  onUpdate: (expenses: ExpenseRequest[]) => void
) => {
  const q = statuses.length > 0
    ? query(collection(db, EXPENSE_COLLECTION), where('status', 'in', statuses))
    : query(collection(db, EXPENSE_COLLECTION));

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
  status: ExpenseStatus,
  reviewerId: string,
  rejectionReason?: string
): Promise<void> => {
  const expenseRef = doc(db, EXPENSE_COLLECTION, expenseId);
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
