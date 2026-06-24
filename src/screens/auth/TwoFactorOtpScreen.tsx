import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, 
  Animated, useWindowDimensions, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const OTP_LEN = 6;
const RESEND_SECS = 30;

export default function TwoFactorOtpScreen() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_SECS);
  const [canResend, setCanResend] = useState(false);
  
  const { user, verifyLoginOtp, persistSession, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < OTP_LEN - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKey = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0)
      inputRefs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code !== '123456') {
      shake();
      Alert.alert('Invalid OTP', 'Please enter the correct OTP.');
      return;
    }
    
    setIsLoading(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    verifyLoginOtp();
    if (user) {
      await persistSession(user, true); // Save session as OTP verified
    }
    setIsLoading(false);
  };

  const handleResend = () => {
    if (!canResend) return;
    // Logic to resend email/username OTP goes here
    setOtp(Array(OTP_LEN).fill(''));
    setTimer(RESEND_SECS);
    setCanResend(false);
    inputRefs.current[0]?.focus();
    Alert.alert('OTP Sent', 'A new code has been sent to your registered email/phone.');
  };

  const handleBack = async () => {
    await logout(); // Cancel login flow completely
  };

  const filled      = otp.filter(Boolean).length;
  const isComplete  = filled === OTP_LEN;
  const BOX         = Math.min(Math.floor((width - 48 - 50) / 6), 52);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconBox}>
              <Ionicons name="shield-checkmark" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Two-Step Verification</Text>
            <Text style={styles.subtitle}>
              An OTP has been sent to your registered mobile number ending in {user?.phoneNumber?.slice(-4) || 'XXXX'}.
            </Text>
          </View>

          {/* OTP Boxes */}
          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array(OTP_LEN).fill(null).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  { width: BOX, height: BOX + 8 },
                  otp[i]       && styles.boxFilled,
                  i === filled  && !isComplete && styles.boxActive,
                  isComplete    && styles.boxDone,
                ]}
              >
                <TextInput
                  ref={r => { inputRefs.current[i] = r; }}
                  style={[styles.boxInput, { fontSize: BOX * 0.45 }]}
                  value={otp[i]}
                  onChangeText={v => handleChange(v, i)}
                  onKeyPress={e => handleKey(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={i === 0}
                  caretHidden
                  editable={!isLoading}
                />
              </View>
            ))}
          </Animated.View>

          {/* Status row */}
          <View style={styles.statusRow}>
            <View style={styles.dots}>
              {Array(OTP_LEN).fill(null).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < filled && { backgroundColor: isComplete ? '#10B981' : '#2563EB', width: 14 },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.statusTxt, isComplete && { color: '#10B981' }]}>
              {isComplete ? '✓ All digits entered' : `${OTP_LEN - filled} digit${OTP_LEN - filled !== 1 ? 's' : ''} remaining`}
            </Text>
          </View>

          {/* Resend Area */}
          <View style={styles.resendArea}>
            {canResend ? (
              <TouchableOpacity style={styles.resendBtn} onPress={handleResend} activeOpacity={0.8}>
                <Ionicons name="refresh" size={15} color="#2563EB" />
                <Text style={styles.resendTxt}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timerWrap}>
                <View style={styles.timerTrack}>
                  <View style={[styles.timerFill, { width: `${((RESEND_SECS - timer) / RESEND_SECS) * 100}%` }]} />
                </View>
                <Text style={styles.timerTxt}>Resend in <Text style={styles.timerCount}>{timer}s</Text></Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
                style={{ width: '100%' }}
                onPress={handleVerify}
                disabled={!isComplete || isLoading}
                activeOpacity={0.88}
          >
            <View style={[styles.btnPrimary, !isComplete && styles.btnDisabled]}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Verify & Proceed</Text>}
            </View>
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 24, 
    paddingBottom: 32 
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
    marginTop: 20,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6
  },
  subtitle: {
    textAlign: 'center', fontSize: 14, color: '#64748B', marginBottom: 16, lineHeight: 22
  },
  otpRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 16,
  },
  box: {
    borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  boxActive:   { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  boxFilled:   { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  boxDone:     { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  boxInput: {
    width: '100%', height: '100%', textAlign: 'center',
    fontWeight: '800', color: '#0F172A', outlineStyle: 'none' as any
  },
  statusRow: { alignItems: 'center', marginBottom: 24, gap: 8 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#E2E8F0' },
  statusTxt: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  
  resendArea: { alignItems: 'center', marginBottom: 28 },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#EFF6FF', borderRadius: 99, paddingHorizontal: 18, paddingVertical: 9,
  },
  resendTxt: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  timerWrap: { alignItems: 'center', gap: 8, width: '70%' },
  timerTrack: { width: '100%', height: 3, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 99 },
  timerTxt: { fontSize: 13, color: '#94A3B8' },
  timerCount: { color: '#2563EB', fontWeight: '700' },

  btnPrimary: {
    width: '100%',
    backgroundColor: '#2563EB', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
