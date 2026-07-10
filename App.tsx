import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './src/firebase/config';
import type { User } from './src/types';
import { usePushNotifications } from './src/hooks/usePushNotifications';

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  // Setup Push Notifications when the user logs in
  usePushNotifications(user?.uid);

  // On mount, restore any persisted session from SecureStore
  useEffect(() => {
    restoreSession();
  }, []);

  // Listen to profile updates in real-time
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.role, 'profiles', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const updatedUser: User = {
          ...user,
          ...data,
          role: data.role || user.role,
        };
        // Update store with new data (like photoURL)
        // using updateUser to preserve existing session state (like isOtpVerified)
        updateUser(updatedUser);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer documentTitle={{ formatter: () => 'Attendance App' }}>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
