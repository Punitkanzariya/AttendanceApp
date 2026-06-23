import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/theme';
import { useAuthStore } from '@/store/authStore';

const OTP_LEN = 6;

export default function TwoFactorOtpScreen() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const { user, verifyLoginOtp, persistSession, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

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

  const handleBack = async () => {
    await logout(); // Cancel login flow completely
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
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

          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array(OTP_LEN).fill(null).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  otp[i] && styles.boxFilled,
                  i === otp.filter(Boolean).length && otp.filter(Boolean).length < OTP_LEN && styles.boxActive,
                  otp.filter(Boolean).length === OTP_LEN && styles.boxDone,
                ]}
              >
                <TextInput
                  ref={r => { inputRefs.current[i] = r; }}
                  style={styles.boxInput}
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

          <TouchableOpacity 
            style={[styles.btnPrimary, otp.filter(Boolean).length !== 6 && styles.btnDisabled]} 
            onPress={handleVerify}
            disabled={otp.filter(Boolean).length !== 6 || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Verify & Proceed</Text>}
          </TouchableOpacity>
          
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  boxActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  boxDone: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  boxInput: {
    width: '100%',
    height: '100%',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    outlineStyle: 'none' as any,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnTxt: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
