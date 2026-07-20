import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from './src/firebase/config';
import type { User } from './src/types';
import { usePushNotifications } from './src/hooks/usePushNotifications';

import { GlobalNotificationToast } from './src/components/GlobalNotificationToast';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setProjectData = useAuthStore((s) => s.setProjectData);

  // Background fetch project data globally
  useEffect(() => {
    if (user?.role === 'employee' && user?.projectId) {
      const unsub = onSnapshot(doc(db, 'projects', user.projectId), async (snap) => {
        if (snap.exists()) {
          const projData = snap.data();
          let assignedProject = projData.name || null;
          let assignedShift = null;
          let assignedShiftName = null;

          if (user?.currentShiftId && projData.availableShifts) {
            const matched = projData.availableShifts.find((s: any) => s.id === user.currentShiftId);
            if (matched) {
              assignedShift = `${matched.startTime} - ${matched.endTime}`;
              assignedShiftName = matched.name;
            }
          }
          if (!assignedShift && projData.workingHours) {
            assignedShift = `${projData.workingHours.start} - ${projData.workingHours.end}`;
            const startH = Number(projData.workingHours.start.split(':')[0]);
            const endH = Number(projData.workingHours.end.split(':')[0]);
            assignedShiftName = startH > endH ? "Night Shift" : "Day Shift";
          }

          let projectManager = null;
          if (projData.managerId) {
            try {
              const mgrSnap = await getDoc(doc(db, 'users', projData.managerId));
              if (mgrSnap.exists()) {
                const mData = mgrSnap.data();
                projectManager = mData.firstName ? `${mData.firstName} ${mData.lastName || ''}`.trim() : mData.displayName || "Unknown";
              }
            } catch (e) {}
          }

          let projectCoordinator = null;
          if (projData.coordinatorId) {
            try {
              const cSnap = await getDoc(doc(db, 'users', projData.coordinatorId));
              if (cSnap.exists()) {
                const cData = cSnap.data();
                projectCoordinator = cData.firstName ? `${cData.firstName} ${cData.lastName || ''}`.trim() : cData.displayName || "Unknown";
              }
            } catch (e) {}
          }

          setProjectData({
            assignedProject,
            assignedShift,
            assignedShiftName,
            projectManager,
            projectCoordinator
          });
        }
      });
      return () => unsub();
    }
  }, [user?.role, user?.projectId, user?.currentShiftId]);

  // Setup Push Notifications when the user logs in
  usePushNotifications(user?.uid);

  // On mount, restore any persisted session from SecureStore
  useEffect(() => {
    restoreSession();
  }, []);

  // Listen to profile updates in real-time
  useEffect(() => {
    if (!user?.uid || !user?.role) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Only update if relevant fields actually changed
        const current = useAuthStore.getState().user;
        if (
          current &&
          current.displayName === (data.displayName ?? current.displayName) &&
          current.profilePicture === (data.profilePicture ?? current.profilePicture) &&
          current.role === (data.role ?? current.role) &&
          current.isActive === (data.isActive ?? current.isActive)
        ) {
          return; // Nothing meaningful changed, skip update
        }
        const updatedUser: User = {
          ...user,
          ...data,
          role: data.role || user.role,
        };
        updateUser(updatedUser);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <NavigationContainer documentTitle={{ formatter: () => 'Attendance App' }}>
          <StatusBar style="auto" />
          <RootNavigator />
          <GlobalNotificationToast />
        </NavigationContainer>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
