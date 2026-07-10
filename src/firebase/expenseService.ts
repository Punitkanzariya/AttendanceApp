import { collection, doc, setDoc, onSnapshot, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './config';
import type { Expense, Project } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const EXPENSE_COLLECTION = 'expenses';
const DRAFT_KEY = '@expense_draft';

// --- Firebase Operations ---

export const submitExpenseRequest = async (
  employeeId: string,
  projectId: string,
  category: string,
  amount: number,
  date: string,
  description: string,
  attachmentUri?: string | null
): Promise<string> => {
  let attachmentUrl = null;

  if (attachmentUri) {
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

  const now = new Date().toISOString();

  const expenseRef = doc(collection(db, EXPENSE_COLLECTION));
  const expenseId = expenseRef.id;
  
  const expenseData: Expense = {
    expenseId,
    employeeId,
    projectId,
    date,
    category,
    amount,
    currency: 'INR',
    description,
    status: 'pending',
    billUrls: attachmentUrl ? [attachmentUrl] : [],
    isDuplicateFlag: false,
    actionLogs: [
      {
        actionBy: employeeId,
        action: 'pending',
        timestamp: now
      }
    ]
  };

  await setDoc(expenseRef, expenseData as any);
  
  // Clear draft if successful
  await clearExpenseDraft();

  return expenseId;
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
  const now = new Date().toISOString();
  
  await updateDoc(expenseRef, {
    category,
    amount,
    date,
    description,
    status: 'pending', // Reset to pending if resubmitted
    billUrls: attachmentUrl ? [attachmentUrl] : [],
    updatedAt: now,
  });
  
  await clearExpenseDraft();
};

export const subscribeToUserExpenses = (
  employeeId: string,
  role: string, // Kept for API compatibility, unused
  onUpdate: (expenses: Expense[]) => void
) => {
  const q = query(
    collection(db, EXPENSE_COLLECTION),
    where('employeeId', '==', employeeId)
  );

  return onSnapshot(q, (snapshot) => {
    const expenses: Expense[] = [];
    snapshot.forEach((docSnap) => {
      expenses.push({ ...docSnap.data() } as Expense);
    });
    
    // Sort locally by actionLogs timestamp
    expenses.sort((a, b) => {
      const timeA = a.actionLogs?.[0]?.timestamp ? new Date(a.actionLogs[0].timestamp).getTime() : 0;
      const timeB = b.actionLogs?.[0]?.timestamp ? new Date(b.actionLogs[0].timestamp).getTime() : 0;
      return timeB - timeA;
    });
    
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

// --- Local Draft Operations ---

export const saveExpenseDraft = async (draft: Partial<Expense>) => {
  try {
    const jsonValue = JSON.stringify(draft);
    await AsyncStorage.setItem(DRAFT_KEY, jsonValue);
  } catch (e) {
    console.error("Error saving expense draft", e);
  }
};

export const getExpenseDraft = async (): Promise<Partial<Expense> | null> => {
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
