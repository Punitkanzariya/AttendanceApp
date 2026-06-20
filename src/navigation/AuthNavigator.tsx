import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';

import SplashScreen        from '@/screens/auth/SplashScreen';
import LoginScreen         from '@/screens/auth/LoginScreen';
import SignupScreen        from '@/screens/auth/SignupScreen';
import PhoneLoginScreen    from '@/screens/auth/PhoneLoginScreen';
import OtpVerifyScreen     from '@/screens/auth/OtpVerifyScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="Login"          component={LoginScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Signup"         component={SignupScreen} />
      <Stack.Screen name="PhoneLogin"     component={PhoneLoginScreen} />
      <Stack.Screen name="OtpVerify"      component={OtpVerifyScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
