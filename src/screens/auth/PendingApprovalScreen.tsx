import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseLogout } from '@/firebase';

export default function PendingApprovalScreen() {
  const { logout, user } = useAuthStore();

  const handleLogout = async () => {
    await firebaseLogout();
    await logout();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Ionicons name="time" size={48} color="#2563EB" />
        </View>

        <Text style={styles.title}>Account Pending Approval</Text>
        <Text style={styles.body}>
          Hi {user?.displayName?.split(' ')[0] || 'there'}, your account has been created successfully but is currently waiting for administrator approval.
        </Text>
        <Text style={styles.body}>
          You will be able to access the app features once an admin assigns you a role and activates your account.
        </Text>

        <View style={styles.statusBox}>
          <Ionicons name="information-circle" size={20} color="#D97706" />
          <Text style={styles.statusTxt}>Status: Inactive / Pending Review</Text>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.btnOutline} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#64748B" />
          <Text style={styles.btnOutlineTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
    marginTop: 16,
  },
  statusTxt: {
    fontSize: 14,
    color: '#B45309',
    fontWeight: '600',
  },
  spacer: { flex: 1 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 52,
    width: '100%',
  },
  btnOutlineTxt: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});
