import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';
import { Colors } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'PhoneLogin'>;

const CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1',  flag: '🇺🇸', name: 'USA'   },
  { code: '+44', flag: '🇬🇧', name: 'UK'    },
  { code: '+971',flag: '🇦🇪', name: 'UAE'   },
];

export default function PhoneLoginScreen() {
  const navigation = useNavigation<Nav>();

  const [cc, setCc]               = useState('+91');
  const [phone, setPhone]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [focused, setFocused]     = useState(false);

  const phoneRegex = /^[6-9]\d{9}$/;
  const isValid    = cc === '+91' ? phoneRegex.test(phone) : phone.length >= 7;
  const selected   = CODES.find(c => c.code === cc)!;

  const handleSend = async () => {
    if (!isValid) { Alert.alert('Invalid Number', 'Please enter a valid mobile number.'); return; }
    setIsLoading(true);
    try {
      navigation.navigate('OtpVerify', { phoneNumber: `${cc}${phone}`, verificationId: 'PLACEHOLDER' });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Static Logo */}
          <View style={{ alignItems: 'center' }}>
            <Image 
              source={require('../../../assets/splash-icon.png')} 
              style={{ width: 150, height: 150, resizeMode: 'contain', marginBottom: 20, marginTop: -10 }} 
            />
          </View>
          <Text style={styles.subtitle}>Enter your mobile number to receive a 6-digit code</Text>

          {/* Input */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={[styles.inputRow, { borderColor: focused ? '#2563EB' : '#E2E8F0' }]}>
              <TouchableOpacity style={styles.ccBtn} onPress={() => setShowPicker(!showPicker)} activeOpacity={0.7}>
                <Text style={styles.flag}>{selected.flag}</Text>
                <Text style={styles.cc}>{selected.code}</Text>
                <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={13} color="#94A3B8" />
              </TouchableOpacity>
              <View style={styles.sep} />
              <TextInput
                style={styles.input} placeholder="XXXXX XXXXX"
                placeholderTextColor="#CBD5E1" keyboardType="phone-pad"
                maxLength={10} value={phone} onChangeText={setPhone}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                autoFocus onSubmitEditing={handleSend}
              />
              {isValid && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
            </View>

            {/* Dropdown */}
            {showPicker && (
              <View style={styles.dropdown}>
                {CODES.map(c => (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.dropItem, c.code === cc && styles.dropItemActive]}
                    onPress={() => { setCc(c.code); setShowPicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropFlag}>{c.flag}</Text>
                    <Text style={styles.dropName}>{c.name}</Text>
                    <Text style={styles.dropCode}>{c.code}</Text>
                    {c.code === cc && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.hint}>
              {cc === '+91' ? 'Enter 10-digit Indian mobile number' : 'Enter number without country code'}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${Math.min((phone.length / 10) * 100, 100)}%`, backgroundColor: isValid ? '#10B981' : '#2563EB' },
              ]} />
            </View>
            <Text style={[styles.progressTxt, { color: isValid ? '#10B981' : '#94A3B8' }]}>{phone.length}/10</Text>
          </View>

          {/* Send OTP */}
          <TouchableOpacity
            style={[styles.btnPrimary, !isValid && styles.btnDisabled]}
            onPress={handleSend} disabled={!isValid || isLoading} activeOpacity={0.88}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send OTP</Text>}
          </TouchableOpacity>

          {/* Or email */}
          <View style={styles.divRow}>
            <View style={styles.divLine} /><Text style={styles.divTxt}>or</Text><View style={styles.divLine} />
          </View>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
            <Ionicons name="mail-outline" size={18} color="#2563EB" />
            <Text style={styles.btnOutlineTxt}>Sign In with Email</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            By continuing you agree to our <Text style={styles.termsLink}>Terms</Text> & <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 32 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
  },
  logoBox: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  subtitle: {textAlign:"center", fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 24 },

  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, backgroundColor: '#F8FAFC',
    paddingHorizontal: 12, height: 54, overflow: 'hidden',
  },
  ccBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 2 },
  flag: { fontSize: 20 },
  cc: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sep: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 10 },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: '#0F172A', letterSpacing: 2, outlineStyle: 'none' },

  dropdown: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    overflow: 'hidden', marginTop: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, backgroundColor: '#fff' },
  dropItemActive: { backgroundColor: '#EFF6FF' },
  dropFlag: { fontSize: 20 },
  dropName: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  dropCode: { fontSize: 13, color: '#64748B' },

  hint: { fontSize: 12, color: '#94A3B8', marginTop: 6 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressTxt: { fontSize: 11, fontWeight: '600', width: 28, textAlign: 'right' },

  btnPrimary: {
    backgroundColor: '#2563EB', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  divTxt: { fontSize: 12, color: '#94A3B8' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#DBEAFE', borderRadius: 14, height: 52,
    backgroundColor: '#EFF6FF', marginBottom: 24,
  },
  btnOutlineTxt: { color: '#2563EB', fontSize: 15, fontWeight: '600' },

  terms: { textAlign: 'center', fontSize: 12, color: '#94A3B8', lineHeight: 18 },
  termsLink: { color: '#2563EB', fontWeight: '600' },
});
