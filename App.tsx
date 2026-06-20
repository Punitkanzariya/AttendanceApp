import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  // On mount, restore any persisted session from SecureStore
  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
