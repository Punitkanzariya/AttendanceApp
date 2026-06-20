import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';

import type { AuthStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { loginWithEmail, checkAccountLockout } from '../../firebase';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation         = useNavigation<Nav>();
  const { persistSession } = useAuthStore();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused]     = useState<string | null>(null);
  const [errors, setErrors]       = useState<{ email?: string; password?: string; general?: string }>({});

  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [lockout, setLockout]             = useState<{ locked: boolean; mins: number } | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRef = useRef<TextInput>(null);
  const lockAnim    = useRef(new Animated.Value(0)).current;

  // 1. Check if biometrics are available on device
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);
    })();
  }, []);

  // 2. Pre-check lockout status if email changes (debounced)
  useEffect(() => {
    if (!emailRegex.test(email)) {
      setLockout(null);
      return;
    }
    const timer = setTimeout(async () => {
      const status = await checkAccountLockout(email);
      if (status.isLocked) {
        setLockout({ locked: true, mins: Math.ceil(status.remainingMs / 60000) });
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true }).start();
      } else {
        setLockout(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim())               e.email    = 'Email is required';
    else if (!emailRegex.test(email)) e.email    = 'Invalid email address';
    if (!password)                   e.password = 'Password is required';
    else if (password.length < 6)    e.password = 'Minimum 6 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    if (lockout?.locked) return;

    setIsLoading(true);
    setErrors({});
    try {
      // Calls our central Firebase authService
      const result = await loginWithEmail(email, password);
      // Persist to Zustand store
      await persistSession(result.user);
    } catch (err: any) {
      if (err.message?.startsWith('ACCOUNT_LOCKED')) {
        const mins = err.message.split(':')[1] || '15';
        setLockout({ locked: true, mins: parseInt(mins, 10) });
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true }).start();
      } else {
        setErrors({ general: err.message });
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
        // PRD Phase-2/Advanced: Validate biometric token with Firebase Custom Auth
      }
    } catch (err) {
      console.log('Biometric error', err);
    }
  };

  const border = (f: string) => errors[f as keyof typeof errors] ? '#EF4444' : focused === f ? '#2563EB' : '#E2E8F0';
  const pwStrength = !password.length ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['#E2E8F0', '#EF4444', '#F59E0B', '#10B981'];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Ionicons name="checkmark-done" size={26} color="#fff" />
            </View>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {/* Error / Lockout Banner */}
          {lockout?.locked ? (
            <Animated.View style={[styles.lockBanner, { transform: [{ scale: lockAnim }] }]}>
              <Ionicons name="lock-closed" size={20} color="#991B1B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.lockTitle}>Account Locked</Text>
                <Text style={styles.lockTxt}>Too many failed attempts. Try again in {lockout.mins} minutes.</Text>
              </View>
            </Animated.View>
          ) : errors.general ? (
            <View style={styles.errBanner}>
              <Ionicons name="warning" size={18} color="#991B1B" />
              <Text style={styles.errBannerTxt}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Work Email</Text>
              <View style={[styles.inputRow, { borderColor: border('email') }, lockout?.locked && styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={18} color={focused === 'email' ? '#2563EB' : '#94A3B8'} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@company.com"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  editable={!lockout?.locked}
                  value={email}
                  onChangeText={v => { setEmail(v); setErrors(p => ({ ...p, email: undefined, general: undefined })); }}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                {email.length > 0 && emailRegex.test(email) && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
              </View>
              {errors.email ? <Text style={styles.err}>{errors.email}</Text> : null}
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
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#CBD5E1"
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  editable={!lockout?.locked}
                  value={password}
                  onChangeText={v => { setPassword(v); setErrors(p => ({ ...p, password: undefined, general: undefined })); }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eye} disabled={lockout?.locked}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.err}>{errors.password}</Text> : null}
            </View>
          </View>

          {/* Sign In & Biometrics */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnPrimary, (!email || !password || isLoading || lockout?.locked) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={!email || !password || isLoading || lockout?.locked}
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

          {/* Security Info (PRD §3.1) */}
          <View style={styles.securityBox}>
            <View style={styles.secRow}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={styles.secTxt}>AES-256 Encryption & App Check</Text>
            </View>
            <View style={styles.secRow}>
              <Ionicons name="phone-portrait" size={14} color="#64748B" />
              <Text style={styles.secTxt}>Max 2 active devices allowed</Text>
            </View>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
  },

  logoRow: { marginBottom: 16 },
  logoBox: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },

  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },

  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 20,
  },
  lockTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B', marginBottom: 2 },
  lockTxt:   { fontSize: 13, color: '#B91C1C' },

  errBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 20,
  },
  errBannerTxt: { flex: 1, fontSize: 13, color: '#B91C1C' },

  form: { gap: 16, marginBottom: 24 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgot: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12, height: 50,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A' },
  eye: { padding: 4 },

  err: { fontSize: 12, color: '#EF4444', marginTop: 2 },

  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  btnPrimary: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bioBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#DBEAFE',
  },
  bioDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },

  securityBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 6, marginBottom: 24,
  },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secTxt: { fontSize: 12, color: '#64748B' },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  divTxt: { fontSize: 12, color: '#94A3B8' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#DBEAFE', borderRadius: 14,
    height: 52, backgroundColor: '#EFF6FF', marginBottom: 28,
  },
  btnOutlineTxt: { color: '#2563EB', fontSize: 15, fontWeight: '600' },

  signupRow: { flexDirection: 'row', justifyContent: 'center' },
  signupTxt: { fontSize: 14, color: '#64748B' },
  signupLink: { fontSize: 14, color: '#2563EB', fontWeight: '700' },
});
