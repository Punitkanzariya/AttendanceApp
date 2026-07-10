import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserNotifications } from '@/firebase/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export function useUnreadNotifications() {
  const { user } = useAuthStore();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    let currentNotifications: any[] = [];
    
    const checkUnread = async () => {
      try {
        const delStr = await AsyncStorage.getItem(`@notifs_del_${user.uid}`);
        const delIds = delStr ? new Set(JSON.parse(delStr)) : new Set();
        
        const hasAnyUnread = currentNotifications.some(n => !n.isRead && !delIds.has(n.notifId));
        setHasUnread(hasAnyUnread);
      } catch (e) {
        console.error(e);
      }
    };

    const unsubscribe = subscribeToUserNotifications(user.uid, (notifications) => {
      currentNotifications = notifications;
      checkUnread();
    });

    const subscription = DeviceEventEmitter.addListener('notifications_read_updated', checkUnread);

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [user]);

  return hasUnread;
}
