import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import type { UserRole } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (user: { fullName: string; email: string; username: string; phone: string; role: UserRole; password?: string }) => Promise<void>;
  isSaving?: boolean;
}

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Employee', value: 'employee' },
  { label: 'Site Supervisor', value: 'site_supervisor' },
  { label: 'Manager', value: 'manager' },
  { label: 'Administrator', value: 'administrator' },
  { label: 'Finance', value: 'finance' },
];

export default function EmployeeAddModal({ visible, onClose, onAdd }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when opened
  React.useEffect(() => {
    if (visible) {
      setFullName('');
      setEmail('');
      setUsername('');
      setPhone('');
      setPassword('');
      setRole('employee');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Full Name, Email and Username are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setIsSaving(true);
      await onAdd({
        fullName,
        email,
        username,
        phone,
        role,
        password: password.trim() ? password : undefined, // Will use default if empty
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add employee.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add New Employee</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Input Fields */}
            <View style={styles.section}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!isSaving}
                />
              </View>

              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. rahul@techsture.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isSaving}
                />
              </View>

              <Text style={styles.label}>Username *</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. rahul_123"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!isSaving}
                />
              </View>

              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isSaving}
                />
              </View>

              <Text style={styles.label}>Temporary Password (Optional)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Defaults to Techsture123!"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSaving}
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
                      disabled={isSaving}
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

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveTxt}>Add Employee</Text>
              )}
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
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: Spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.xs,
  },
  input: Platform.select({
    web: {
      flex: 1,
      marginLeft: Spacing.sm,
      fontSize: FontSize.md,
      color: Colors.text.primary,
      height: '100%',
      outlineStyle: 'none',
    } as any,
    default: {
      flex: 1,
      marginLeft: Spacing.sm,
      fontSize: FontSize.md,
      color: Colors.text.primary,
      height: '100%',
    }
  }),
  roleGrid: {
    marginTop: Spacing.xs,
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
