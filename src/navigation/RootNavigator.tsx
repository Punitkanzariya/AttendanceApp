import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/theme';
import { db, firebaseLogout } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import AuthNavigator from '@/navigation/AuthNavigator';
import EmployeeNavigator from '@/navigation/EmployeeNavigator';
import NotificationScreen from '@/screens/main/shared/NotificationScreen';

const Root = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isLoading, isAuthenticated, user, setUser, persistSession } = useAuthStore();

  React.useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;

    // Listen to new flat users collection
    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        let roleData: any = undefined;
        if (userData.roleId) {
          const roleRef = doc(db, 'roles', userData.roleId);
          const roleSnap = await import('firebase/firestore').then(m => m.getDoc(roleRef));
          if (roleSnap.exists()) {
            roleData = roleSnap.data();
          }
        }

        const currentUser = useAuthStore.getState().user;
        
        if (
          currentUser && 
          (userData.isActive !== currentUser.isActive || userData.role !== currentUser.role || roleData)
        ) {
          const updatedUser = { ...currentUser, ...userData, roleData };
          useAuthStore.getState().setUser(updatedUser);
          useAuthStore.getState().persistSession(updatedUser);
        }
      } else {
        await firebaseLogout();
        useAuthStore.getState().logout();
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, user?.uid]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Root.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Root.Screen name="EmployeeApp" component={EmployeeNavigator} />
          <Root.Screen 
            name="Notifications" 
            component={NotificationScreen} 
            options={{ 
              animation: 'none',
              presentation: 'transparentModal'
            }}
          />
        </>
      )}
    </Root.Navigator>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
