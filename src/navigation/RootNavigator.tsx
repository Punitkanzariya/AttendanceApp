import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { db, firebaseLogout } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from '../types';

import AuthNavigator from './AuthNavigator';
import EmployeeNavigator from './EmployeeNavigator';
import SiteSupervisorNavigator from './SiteSupervisorNavigator';
import ManagerNavigator from './ManagerNavigator';
import AdminNavigator from './AdminNavigator';
import FinanceNavigator from './FinanceNavigator';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';

const Root = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator
 *
 * - While restoring session: shows a full-screen spinner
 * - Unauthenticated: shows AuthNavigator
 * - Authenticated: routes to the role-specific navigator
 */
export default function RootNavigator() {
  const { isLoading, isAuthenticated, user, setUser, persistSession } = useAuthStore();

  React.useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;

    const userRef = doc(db, 'employees', user.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) {
        // The user's document was deleted from Firestore (e.g. by an Admin).
        // Force logout immediately.
        await firebaseLogout();
        useAuthStore.getState().logout();
        return;
      }

      const userData = docSnap.data() as User;
      const currentUser = useAuthStore.getState().user;
      
      if (
        currentUser && 
        (userData.isActive !== currentUser.isActive || userData.role !== currentUser.role)
      ) {
        const updatedUser = { ...currentUser, ...userData };
        useAuthStore.getState().setUser(updatedUser);
        useAuthStore.getState().persistSession(updatedUser);
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
    <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated ? (
        <Root.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          {/* If the user is authenticated but not active, block access unless they are the admin bypass */}
          {user && !user.isActive && user.role !== 'administrator' ? (
            <Root.Screen name="PendingApproval" component={PendingApprovalScreen} />
          ) : (
            <>
              {user?.role === 'employee' && (
                <Root.Screen name="EmployeeApp" component={EmployeeNavigator} />
              )}
          {user?.role === 'site_supervisor' && (
            <Root.Screen name="SiteSupervisorApp" component={SiteSupervisorNavigator} />
          )}
          {user?.role === 'manager' && (
            <Root.Screen name="ManagerApp" component={ManagerNavigator} />
          )}
          {user?.role === 'administrator' && (
            <Root.Screen name="AdminApp" component={AdminNavigator} />
          )}
          {user?.role === 'finance' && (
            <Root.Screen name="FinanceApp" component={FinanceNavigator} />
          )}
            </>
          )}
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
