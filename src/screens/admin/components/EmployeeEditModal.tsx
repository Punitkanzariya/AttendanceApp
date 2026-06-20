import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import type { User, UserRole } from '@/types';

interface Props {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (uid: string, updates: Partial<User>) => Promise<void>;
}

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Employee', value: 'employee' },
  { label: 'Site Supervisor', value: 'site_supervisor' },
  { label: 'Manager', value: 'manager' },
  { label: 'Administrator', value: 'administrator' },
  { label: 'Finance', value: 'finance' },
];

export default function EmployeeEditModal({ visible, user, onClose, onSave }: Props) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>('employee');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when user changes
  React.useEffect(() => {
    if (user) {
      setIsActive(user.isActive);
      setRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(user.uid, { isActive, role });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update employee.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Employee</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* User Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{user.displayName?.charAt(0) || '?'}</Text>
              </View>
              <View>
                <Text style={styles.name}>{user.displayName || 'Unnamed User'}</Text>
                <Text style={styles.email}>{user.email}</Text>
                {user.phoneNumber && <Text style={styles.email}>{user.phoneNumber}</Text>}
              </View>
            </View>

            {/* Status Toggle */}
            <View style={styles.section}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.label}>Account Status</Text>
                  <Text style={styles.subLabel}>
                    {isActive ? 'Active (Can login)' : 'Pending/Inactive (Cannot login)'}
                  </Text>
                </View>
                <Switch 
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: Colors.border, true: Colors.success }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Role Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Assign Role</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => {
                  const selected = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleBtn, selected && styles.roleBtnActive]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'} 
                        size={18} 
                        color={selected ? Colors.primary : Colors.text.tertiary} 
                      />
                      <Text style={[styles.roleTxt, selected && styles.roleTxtActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
              <Text style={styles.saveTxt}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    minHeight: '60%',
    maxHeight: '90%',
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  content: {
    padding: Spacing.xl,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarTxt: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  roleGrid: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: Spacing.sm,
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleTxt: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  roleTxtActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  cancelTxt: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  saveTxt: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
});
