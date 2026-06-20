import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { AuthStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { loginWithEmail, checkAccountLockout } from '@/firebase';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(6, 'Minimum 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const navigation         = useNavigation<Nav>();
  const { persistSession } = useAuthStore();

  const { control, handleSubmit, watch, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const emailValue = watch('email');
  const passwordValue = watch('password');

  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused]     = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [lockout, setLockout]             = useState<{ locked: boolean; mins: number } | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const lockAnim    = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(30)).current;
  const logoTranslateY = useRef(new Animated.Value(100)).current;

  // 1. Check if biometrics are available on device
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoTranslateY, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }),
      Animated.spring(formTranslateY, { toValue: 0, tension: 40, friction: 8, delay: 100, useNativeDriver: true }),
    ]).start();

    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);
    })();
  }, []);

  // 2. Pre-check lockout status if email changes (debounced)
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailValue || !emailRegex.test(emailValue)) {
      setLockout(null);
      return;
    }
    const timer = setTimeout(async () => {
      const status = await checkAccountLockout(emailValue);
      if (status.isLocked) {
        setLockout({ locked: true, mins: Math.ceil(status.remainingMs / 60000) });
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true }).start();
      } else {
        setLockout(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [emailValue]);

  const onSubmit = async (data: LoginFormValues) => {
    if (lockout?.locked) return;

    setIsLoading(true);
    setGeneralError(null);
    try {
      const result = await loginWithEmail(data.email, data.password);
      await persistSession(result.user);
    } catch (err: any) {
      if (err.message?.startsWith('ACCOUNT_LOCKED')) {
        const mins = err.message.split(':')[1] || '15';
        setLockout({ locked: true, mins: parseInt(mins, 10) });
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true }).start();
      } else {
        setGeneralError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to WorkTrack',
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        Alert.alert('Success', 'Biometric verified! (Hook up token here)');
      }
    } catch (err) {
      console.log('Biometric error', err);
    }
  };

  const border = (f: string) => errors[f as keyof typeof errors] ? '#EF4444' : focused === f ? '#3B82F6' : '#E2E8F0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Animated Logo */}
          <Animated.View style={{ alignItems: 'center', transform: [{ translateY: logoTranslateY }] }}>
            <Image 
              source={require('../../../assets/splash-icon.png')} 
              style={{ width: 150, height: 250, resizeMode: 'contain', marginBottom: 10, marginTop: -10 }} 
            />
          </Animated.View>

          {/* Animated Form */}
          <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formTranslateY }] }}>
            {/* Error / Lockout Banner */}
            {lockout?.locked ? (
              <Animated.View style={[styles.lockBanner, { transform: [{ scale: lockAnim }] }]}>
                <Ionicons name="lock-closed" size={20} color="#991B1B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockTitle}>Account Locked</Text>
                  <Text style={styles.lockTxt}>Too many failed attempts. Try again in {lockout.mins} minutes.</Text>
                </View>
              </Animated.View>
            ) : generalError ? (
              <View style={styles.errBanner}>
                <Ionicons name="warning" size={18} color="#991B1B" />
                <Text style={styles.errBannerTxt}>{generalError}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>Work Email</Text>
                <View style={[styles.inputRow, { borderColor: border('email') }, lockout?.locked && styles.inputDisabled]}>
                  <Ionicons name="mail-outline" size={18} color={focused === 'email' ? '#2563EB' : '#94A3B8'} style={styles.icon} />
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="you@company.com"
                        placeholderTextColor="#CBD5E1"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                        editable={!lockout?.locked}
                        value={value}
                        onChangeText={(v) => { onChange(v); setGeneralError(null); }}
                        onFocus={() => setFocused('email')}
                        onBlur={() => { onBlur(); setFocused(null); }}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                      />
                    )}
                  />
                  {emailValue.length > 0 && !errors.email && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                </View>
                {errors.email ? <Text style={styles.err}>{errors.email.message}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text style={styles.forgot}>Forgot?</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputRow, { borderColor: border('password') }, lockout?.locked && styles.inputDisabled]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? '#2563EB' : '#94A3B8'} style={styles.icon} />
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        ref={passwordRef}
                        style={styles.input}
                        placeholder="Enter password"
                        placeholderTextColor="#CBD5E1"
                        secureTextEntry={!showPass}
                        returnKeyType="done"
                        editable={!lockout?.locked}
                        value={value}
                        onChangeText={(v) => { onChange(v); setGeneralError(null); }}
                        onFocus={() => setFocused('password')}
                        onBlur={() => { onBlur(); setFocused(null); }}
                        onSubmitEditing={handleSubmit(onSubmit)}
                      />
                    )}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eye} disabled={lockout?.locked}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.err}>{errors.password.message}</Text> : null}
              </View>
            </View>

            {/* Sign In & Biometrics */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, (!emailValue || !passwordValue || isLoading || lockout?.locked) && styles.btnDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={!emailValue || !passwordValue || isLoading || lockout?.locked}
                activeOpacity={0.88}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Sign In</Text>}
              </TouchableOpacity>

              {hasBiometrics && (
                <TouchableOpacity
                  style={[styles.bioBtn, lockout?.locked && styles.bioDisabled]}
                  onPress={handleBiometricLogin}
                  disabled={lockout?.locked}
                >
                  <Ionicons name="finger-print" size={24} color={lockout?.locked ? '#94A3B8' : '#2563EB'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divRow}>
              <View style={styles.divLine} /><Text style={styles.divTxt}>or</Text><View style={styles.divLine} />
            </View>

            {/* OTP Option */}
            <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('PhoneLogin')} activeOpacity={0.88}>
              <Ionicons name="chatbubbles-outline" size={18} color="#2563EB" />
              <Text style={styles.btnOutlineTxt}>Sign in with OTP</Text>
            </TouchableOpacity>

            {/* Sign up */}
            <View style={styles.signupRow}>
              <Text style={styles.signupTxt}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}> Create Account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },

  logoContainer: { alignItems: 'center', marginBottom: 20, marginTop: -10 },
  logoImage: { width: 150, height: 150, resizeMode: 'contain' },

  form: { gap: 20, marginBottom: 32 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginLeft: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgot: { fontSize: 13, color: '#3B82F6', fontWeight: '600', marginRight: 4 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 16,
    backgroundColor: '#F8FAFC', paddingHorizontal: 16, height: 56,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.7 },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '500', outlineStyle: 'none' },
  eye: { padding: 8, marginRight: -4 },

  err: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 },

  btnRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  btnPrimary: {
    flex: 1, backgroundColor: '#3B82F6', borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  
  bioBtn: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  bioDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  divLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  divTxt: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16,
    height: 56, backgroundColor: '#ffffff', marginBottom: 32,
  },
  btnOutlineTxt: { color: '#475569', fontSize: 16, fontWeight: '600' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupTxt: { fontSize: 15, color: '#64748B' },
  signupLink: { fontSize: 15, color: '#3B82F6', fontWeight: '700' },
  
  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#FECACA', marginBottom: 24,
  },
  lockTitle: { fontSize: 15, fontWeight: '700', color: '#991B1B', marginBottom: 4 },
  lockTxt:   { fontSize: 14, color: '#B91C1C', lineHeight: 20 },

  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#FECACA', marginBottom: 24,
  },
  errBannerTxt: { flex: 1, fontSize: 14, color: '#B91C1C', fontWeight: '500' },
});
