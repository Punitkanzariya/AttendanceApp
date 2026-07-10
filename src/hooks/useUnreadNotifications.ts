import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserLeaves } from '@/firebase/leaveService';
import { subscribeToUserExpenses } from '@/firebase/expenseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export function useUnreadNotifications() {
  const { user } = useAuthStore();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    let unsubLeaves: () => void;
    let unsubExpenses: () => void;
    let leaves: any[] = [];
    let expenses: any[] = [];
    
    const checkUnread = async () => {
      try {
        const readStr = await AsyncStorage.getItem(`@notifs_read_${user.uid}`);
        const delStr = await AsyncStorage.getItem(`@notifs_del_${user.uid}`);
        const readIds = readStr ? new Set(JSON.parse(readStr)) : new Set();
        const delIds = delStr ? new Set(JSON.parse(delStr)) : new Set();

        const allIds = [
          ...leaves.map(l => `leave_${l.requestId || l.id}`),
          ...expenses.map(e => `expense_${e.expenseId || e.id}`)
        ];
        
        const hasAnyUnread = allIds.some(id => !readIds.has(id) && !delIds.has(id));
        setHasUnread(hasAnyUnread);
      } catch (e) {
        console.error('Error checking unread notifications:', e);
      }
    };

    const isEmployee = user.role === 'employee';

    const onLeavesChange = (data: any[]) => {
      leaves = data;
      checkUnread();
    };
    
    const onExpensesChange = (data: any[]) => {
      expenses = data;
      checkUnread();
    };

    unsubLeaves = subscribeToUserLeaves(user.uid, user.role, onLeavesChange);
    unsubExpenses = subscribeToUserExpenses(user.uid, user.role, onExpensesChange);

    const subscription = DeviceEventEmitter.addListener('notifications_read_updated', checkUnread);

    return () => {
      subscription.remove();
      if (unsubLeaves) unsubLeaves();
      if (unsubExpenses) unsubExpenses();
    };
  }, [user]);

  return hasUnread;
}
