import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import { Colors } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { registerWithEmail } from '@/firebase';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation         = useNavigation<Nav>();
  const { persistSession } = useAuthStore();

  // Step 0: Personal | Step 1: Credentials
  const [step, setStep] = useState<0 | 1>(0);

  // Step 0 fields
  const [fullName, setFullName]   = useState('');
  const [department, setDept]     = useState('');

  // Step 1 fields
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [empId, setEmpId]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showCnf, setShowCnf]     = useState(false);
  const [agreed, setAgreed]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused]     = useState<string | null>(null);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const deptRef  = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const empRef   = useRef<TextInput>(null);
  const passRef  = useRef<TextInput>(null);
  const cnfRef   = useRef<TextInput>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[6-9]\d{9}$/;

  const b = (f: string) =>
    errors[f] ? '#EF4444' : focused === f ? '#2563EB' : '#E2E8F0';

  const validateStep0 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2)
      e.fullName = 'Enter your full name (min 2 characters)';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!email.trim() || !emailRegex.test(email)) e.email   = 'Enter a valid work email';
    if (!phoneRegex.test(phone))                   e.phone   = 'Enter a valid 10-digit number';
    if (password.length < 8)                       e.password = 'Minimum 8 characters';
    if (confirm !== password)                      e.confirm  = 'Passwords do not match';
    if (!agreed)                                   e.agreed   = 'Please accept the terms to continue';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSignup = async () => {
    if (!validateStep1()) return;
    setIsLoading(true);
    try {
      const user = await registerWithEmail({
        fullName,
        email,
        phone,
        password,
        department,
        employeeId: empId,
      });

      // Show success alert before going to employee app (which will likely say "Waiting for admin approval")
      if (Platform.OS === 'web') {
        window.alert('Registration Successful! Your account has been created. An administrator will review and activate your account shortly.');
        await persistSession(user);
      } else {
        Alert.alert(
          'Registration Successful',
          'Your account has been created. An administrator will review and activate your account shortly.',
          [{ text: 'OK', onPress: async () => await persistSession(user) }]
        );
      }
    } catch (err: any) {
      let msg = err.message ?? 'Something went wrong. Try again.';
      if (msg.includes('auth/email-already-in-use')) {
        msg = 'This email is already registered. Please go back and Sign In.';
      }
      
      if (Platform.OS === 'web') {
        window.alert('Registration Failed: ' + msg);
      } else {
        Alert.alert('Registration Failed', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const pwStr   = !password.length ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwColor = ['#E2E8F0', '#EF4444', '#F59E0B', '#10B981'][pwStr];
  const pwLabel = ['', 'Weak', 'Fair', 'Strong'][pwStr];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Static Logo */}
          <View style={{ alignItems: 'center' }}>
            <Image 
              source={require('../../../assets/splash-icon.png')} 
              style={{ width: 150, height: 150, resizeMode: 'contain', marginBottom: 20, marginTop: -10 }} 
            />
          </View>

          {/* Step bar */}
          <View style={styles.stepBarRow}>
            <View style={[styles.stepDot, step >= 0 && styles.stepDotActive]}>
              {step > 0
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={styles.stepDotTxt}>1</Text>
              }
            </View>
            <View style={[styles.stepLine, step >= 1 && styles.stepLineFilled]} />
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
              <Text style={[styles.stepDotTxt, step >= 1 && { color: '#fff' }]}>2</Text>
            </View>
          </View>
          <Text style={styles.stepLabel}>
            Step {step + 1} of 2 — {step === 0 ? 'Personal Details' : 'Login Credentials'}
          </Text>

          {/* ── Step 0: Personal Details ── */}
          {step === 0 && (
            <View style={styles.form}>
              {/* Admin role info banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={17} color="#2563EB" />
                <Text style={styles.infoTxt}>
                  Your role (Employee, Manager, etc.) will be assigned by your Administrator after registration.
                </Text>
              </View>

              {/* Full Name */}
              <View style={styles.field}>
                <Text style={styles.label}>Full Name <Text style={styles.req}>*</Text></Text>
                <View style={[styles.row, { borderColor: b('fullName') }]}>
                  <Ionicons name="person-outline" size={18} color={focused === 'fullName' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Ravi Sharma"
                    placeholderTextColor="#CBD5E1"
                    autoFocus
                    value={fullName}
                    onChangeText={v => { setFullName(v); setErrors(p => ({ ...p, fullName: '' })); }}
                    onFocus={() => setFocused('fullName')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => deptRef.current?.focus()}
                  />
                </View>
                {errors.fullName ? <Text style={styles.err}>{errors.fullName}</Text> : null}
              </View>

              {/* Department (optional) */}
              <View style={styles.field}>
                <Text style={styles.label}>Department <Text style={styles.opt}>(optional)</Text></Text>
                <View style={[styles.row, { borderColor: b('dept') }]}>
                  <Ionicons name="business-outline" size={18} color={focused === 'dept' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    ref={deptRef}
                    style={styles.input}
                    placeholder="e.g. Operations, Finance"
                    placeholderTextColor="#CBD5E1"
                    value={department}
                    onChangeText={setDept}
                    onFocus={() => setFocused('dept')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── Step 1: Login Credentials ── */}
          {step === 1 && (
            <View style={styles.form}>
              {/* Work Email */}
              <View style={styles.field}>
                <Text style={styles.label}>Work Email <Text style={styles.req}>*</Text></Text>
                <View style={[styles.row, { borderColor: b('email') }]}>
                  <Ionicons name="mail-outline" size={18} color={focused === 'email' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                    value={email}
                    onChangeText={v => { setEmail(v); setErrors(p => ({ ...p, email: '' })); }}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                  {email.length > 0 && emailRegex.test(email) && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </View>
                {errors.email ? <Text style={styles.err}>{errors.email}</Text> : null}
              </View>

              {/* Mobile */}
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number <Text style={styles.req}>*</Text></Text>
                <View style={[styles.row, { borderColor: b('phone') }]}>
                  <Text style={styles.cc}>🇮🇳 +91</Text>
                  <View style={styles.sep} />
                  <TextInput
                    ref={phoneRef}
                    style={[styles.input, { paddingLeft: 10 }]}
                    placeholder="XXXXX XXXXX"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={v => { setPhone(v); setErrors(p => ({ ...p, phone: '' })); }}
                    onFocus={() => setFocused('phone')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => empRef.current?.focus()}
                  />
                  {phone.length === 10 && phoneRegex.test(phone) && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </View>
                {errors.phone ? <Text style={styles.err}>{errors.phone}</Text> : null}
              </View>

              {/* Employee ID (optional) */}
              <View style={styles.field}>
                <Text style={styles.label}>Employee ID <Text style={styles.opt}>(optional)</Text></Text>
                <View style={[styles.row, { borderColor: b('empId') }]}>
                  <Ionicons name="card-outline" size={18} color={focused === 'empId' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    ref={empRef}
                    style={styles.input}
                    placeholder="e.g. EMP-1042"
                    placeholderTextColor="#CBD5E1"
                    autoCapitalize="characters"
                    value={empId}
                    onChangeText={setEmpId}
                    onFocus={() => setFocused('empId')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => passRef.current?.focus()}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>Password <Text style={styles.req}>*</Text></Text>
                <View style={[styles.row, { borderColor: b('password') }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    ref={passRef}
                    style={styles.input}
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry={!showPass}
                    value={password}
                    onChangeText={v => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => cnfRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eye}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={19} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {password.length > 0 && (
                  <View style={styles.strengthRow}>
                    {[1,2,3].map(i => (
                      <View key={i} style={[styles.sBar, { backgroundColor: i <= pwStr ? pwColor : '#E2E8F0' }]} />
                    ))}
                    <Text style={[styles.sLbl, { color: pwColor }]}>{pwLabel}</Text>
                  </View>
                )}
                {errors.password ? <Text style={styles.err}>{errors.password}</Text> : null}
              </View>

              {/* Confirm Password */}
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password <Text style={styles.req}>*</Text></Text>
                <View style={[styles.row, { borderColor: b('confirm') }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={focused === 'confirm' ? '#2563EB' : '#94A3B8'} style={styles.ic} />
                  <TextInput
                    ref={cnfRef}
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry={!showCnf}
                    value={confirm}
                    onChangeText={v => { setConfirm(v); setErrors(p => ({ ...p, confirm: '' })); }}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                  <TouchableOpacity onPress={() => setShowCnf(!showCnf)} style={styles.eye}>
                    <Ionicons name={showCnf ? 'eye-off-outline' : 'eye-outline'} size={19} color="#94A3B8" />
                  </TouchableOpacity>
                  {confirm.length > 0 && confirm === password && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </View>
                {errors.confirm ? <Text style={styles.err}>{errors.confirm}</Text> : null}
              </View>

              {/* Terms */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => { setAgreed(!agreed); setErrors(p => ({ ...p, agreed: '' })); }}
                activeOpacity={0.8}
              >
                <View style={[styles.check, agreed && styles.checkOn]}>
                  {agreed && <Ionicons name="checkmark" size={11} color="#fff" />}
                </View>
                <Text style={styles.termsTxt}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
              {errors.agreed ? <Text style={[styles.err, { marginTop: 4 }]}>{errors.agreed}</Text> : null}
            </View>
          )}

          {/* CTA */}
          {step === 0 ? (
            <TouchableOpacity
              style={[styles.btnPrimary, !fullName.trim() && styles.btnOff]}
              onPress={() => { if (validateStep0()) setStep(1); }}
              disabled={!fullName.trim()}
              activeOpacity={0.88}
            >
              <Text style={styles.btnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, isLoading && styles.btnOff]}
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnTxt}>Create Account</Text>
              }
            </TouchableOpacity>
          )}

          <View style={styles.signinRow}>
            <Text style={styles.signinTxt}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signinLink}> Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 16 },

  /* Step bar */
  stepBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#2563EB' },
  stepDotTxt: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 6 },
  stepLineFilled: { backgroundColor: '#2563EB' },
  stepLabel: { fontSize: 13, color: '#64748B', marginBottom: 20 },

  /* Info banner */
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoTxt: { flex: 1, fontSize: 13, color: '#1D4ED8', lineHeight: 20 },

  /* Form */
  form: { gap: 16, marginBottom: 24 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  req:   { color: '#EF4444' },
  opt:   { color: '#94A3B8', fontWeight: '400', fontSize: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, backgroundColor: '#F8FAFC',
    paddingHorizontal: 12, height: 50,
  },
  ic:  { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', outlineStyle: 'none' as any },
  eye: { padding: 4 },
  cc:  { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  sep: { width: 1, height: 22, backgroundColor: '#E2E8F0', marginHorizontal: 8 },
  err: { fontSize: 12, color: '#EF4444' },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sBar: { flex: 1, height: 3, borderRadius: 99 },
  sLbl: { fontSize: 11, fontWeight: '600', width: 36, textAlign: 'right' },

  /* Terms */
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: {
    width: 20, height: 20, borderRadius: 6, marginTop: 1,
    borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  termsTxt: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 20 },
  termsLink: { color: '#2563EB', fontWeight: '600' },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row', backgroundColor: '#2563EB', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnOff: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  signinRow: { flexDirection: 'row', justifyContent: 'center' },
  signinTxt: { fontSize: 14, color: '#64748B' },
  signinLink: { fontSize: 14, color: '#2563EB', fontWeight: '700' },
});
