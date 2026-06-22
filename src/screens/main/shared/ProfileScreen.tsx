import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const renderRow = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
    </View>
  );

  const formatRole = (role?: string) => {
    if (!role) return 'N/A';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.card}>
            {/* Avatar (Overlapping) */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text>
              </View>
            </View>

            {/* Profile Details */}
            <View style={styles.detailsContainer}>
              {renderRow('Employee ID', user?.uid.slice(0, 8).toUpperCase() || 'N/A')}
              {renderRow('Name', user?.displayName || 'Unknown')}
              {renderRow('Role', formatRole(user?.role))}
              {renderRow('Email', user?.email || 'N/A')}
              {renderRow('Phone', user?.phoneNumber || 'Not provided')}
              {renderRow('Status', user?.isActive ? 'Active' : 'Inactive')}
            </View>

          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutCard} onPress={logout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.employeeBg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.employeeBg,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl + 20, // Space for avatar overlap
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: -50, // pull up to overlap
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    borderWidth: 4,
    borderColor: Colors.employeeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  detailsContainer: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  label: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    flex: 1,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    width: '100%',
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#EF4444', // slightly brighter red matching the image
    marginLeft: Spacing.sm,
  },
});
