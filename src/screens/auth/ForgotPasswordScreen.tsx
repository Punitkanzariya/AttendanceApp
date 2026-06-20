import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import { Colors } from '@/theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]         = useState('');
  const [sent, setSent]           = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused]     = useState(false);
  const [error, setError]         = useState('');

  const successScale = useRef(new Animated.Value(0.8)).current;
  const emailRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSend = async () => {
    if (!email.trim())              { setError('Email is required'); return; }
    if (!emailRegex.test(email))    { setError('Enter a valid email address'); return; }
    setIsLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1400));
      setSent(true);
      Animated.spring(successScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {!sent ? (
            <>
              {/* Static Logo */}
              <View style={{ alignItems: 'center' }}>
                <Image 
                  source={require('../../../assets/splash-icon.png')} 
                  style={{ width: 150, height: 150, resizeMode: 'contain', marginBottom: 20, marginTop: -10 }} 
                />
              </View>
              <Text style={styles.subtitle}>Enter your registered email and we'll send you a reset link.</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <View style={[styles.inputRow, {
                  borderColor: error ? '#EF4444' : focused ? '#2563EB' : '#E2E8F0',
                }]}>
                  <Ionicons name="mail-outline" size={18} color={focused ? '#2563EB' : '#94A3B8'} style={styles.icon} />
                  <TextInput
                    style={styles.input} placeholder="you@company.com"
                    placeholderTextColor="#CBD5E1" keyboardType="email-address"
                    autoCapitalize="none" autoFocus value={email}
                    onChangeText={v => { setEmail(v); setError(''); }}
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    onSubmitEditing={handleSend} returnKeyType="send"
                  />
                  {email.length > 0 && emailRegex.test(email) && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                </View>
                {error ? <Text style={styles.err}>{error}</Text> : null}
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!email || isLoading) && styles.btnDisabled]}
                onPress={handleSend} disabled={!email || isLoading} activeOpacity={0.88}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send Reset Link</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('Login')}>
                <Ionicons name="chevron-back" size={15} color="#2563EB" />
                <Text style={styles.backLinkTxt}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
              <View style={styles.successRing}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
              </View>
              <Text style={styles.successTitle}>Email Sent!</Text>
              <Text style={styles.successBody}>
                We sent a reset link to
              </Text>
              <View style={styles.emailPill}>
                <Ionicons name="mail" size={14} color="#2563EB" />
                <Text style={styles.emailPillTxt}>{email}</Text>
              </View>
              <Text style={styles.successNote}>Check your inbox and spam. Link expires in 30 minutes.</Text>

              <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
                <Text style={styles.btnPrimaryText}>Back to Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }}>
                <Text style={styles.tryOther}>Try a different email</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
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
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  subtitle: { textAlign:"center",fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 24 },

  field: { gap: 6, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, backgroundColor: '#F8FAFC',
    paddingHorizontal: 12, height: 50,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', outlineStyle: 'none' },
  err: { fontSize: 12, color: '#EF4444', marginTop: 2 },

  btnPrimary: {
    backgroundColor: '#2563EB', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  backLinkTxt: { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  /* Success */
  successCard: { alignItems: 'center', paddingTop: 20 },
  successRing: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  successBody: { fontSize: 14, color: '#64748B', marginBottom: 10 },
  emailPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 16,
  },
  emailPillTxt: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  successNote: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 12 },
  tryOther: { fontSize: 13, color: '#64748B', textDecorationLine: 'underline', textAlign: 'center' },
});
