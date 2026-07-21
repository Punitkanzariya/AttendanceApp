import { collection, doc, setDoc, onSnapshot, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
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
  attachmentUri?: string | null,
  attachmentName?: string | null,
  isDuplicateFlag: boolean = false
): Promise<string> => {
  let attachmentUrl = null;

  if (attachmentUri) {
    try {
      let uriToUpload = attachmentUri;
      let ext = (attachmentName || uriToUpload).split('.').pop()?.toLowerCase() || 'jpg';
      if (ext.length > 4 || ext.includes('/')) ext = 'jpg'; // fallback for weird URIs
      const isPdf = ext === 'pdf' || uriToUpload.toLowerCase().endsWith('.pdf');

      if (Platform.OS !== 'web' && !isPdf) {
        const manipResult = await ImageManipulator.manipulateAsync(
          attachmentUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        uriToUpload = manipResult.uri;
        ext = 'jpg';
      }

      const response = await fetch(uriToUpload);
      const blob = await response.blob();
      
      const safeCategory = category.replace(/\s+/g, '');
      const fileName = `${date}_${safeCategory}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, `employees/${employeeId}/expenses/${fileName}`);
      
      await uploadBytes(storageRef, blob);
      attachmentUrl = await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Error uploading attachment to storage", e);
      throw new Error("Failed to process attachment");
    }
  }

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
    isDuplicateFlag: isDuplicateFlag,
    approvers: approvers,
    actionLogs: [
      {
        actionBy: employeeId,
        action: 'pending',
        timestamp: now
      }
    ]
  };

  await setDoc(expenseRef, expenseData as any);
  
  // Push notification to approvers (Coordinator, Manager, or Admins)
  if (approvers.length > 0) {
    for (const approverId of approvers) {
      const newNotifRef = doc(collection(db, 'notifications', approverId, 'items'));
      try {
        await setDoc(newNotifRef, {
          notifId: newNotifRef.id,
          title: "New Expense Claim",
          message: `An employee has submitted a new expense claim of ₹${amount} for ${category}.`,
          type: "info",
          isRead: false,
          link: "/dashboard/expenses/approval-queue",
          
          sentBy: employeeId,
          receivedBy: approverId,
          isBroadcast: false,
          
          module: "expense",
          entityId: expenseId,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error("Failed to send expense notification to", approverId, err);
      }
    }
  }

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
  existingAttachmentUrl?: string | null,
  attachmentName?: string | null
): Promise<void> => {
  let attachmentUrl = existingAttachmentUrl;

  if (attachmentUri && !attachmentUri.startsWith('http')) {
    try {
      let uriToUpload = attachmentUri;
      let ext = (attachmentName || uriToUpload).split('.').pop()?.toLowerCase() || 'jpg';
      if (ext.length > 4 || ext.includes('/')) ext = 'jpg';
      const isPdf = ext === 'pdf' || uriToUpload.toLowerCase().endsWith('.pdf');

      if (Platform.OS !== 'web' && !attachmentUri.startsWith('data:') && !isPdf) {
        const manipResult = await ImageManipulator.manipulateAsync(
          attachmentUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        uriToUpload = manipResult.uri;
        ext = 'jpg';
      }

      const response = await fetch(uriToUpload);
      const blob = await response.blob();
      
      const safeCategory = category.replace(/\s+/g, '');
      const fileName = `${date}_${safeCategory}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, `employees/${employeeId}/expenses/${fileName}`);
      
      await uploadBytes(storageRef, blob);
      attachmentUrl = await getDownloadURL(storageRef);
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
