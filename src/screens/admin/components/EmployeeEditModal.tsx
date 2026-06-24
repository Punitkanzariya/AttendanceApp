import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, ScrollView, Alert, TextInput, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import type { User, UserRole } from '@/types';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToBase64 } from '@/utils/imageUtils';

interface Props {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (uid: string, updates: Partial<User>) => Promise<void>;
}

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Administrator', value: 'administrator' },
  { label: 'Finance', value: 'finance' },
  { label: 'HR Manager', value: 'hr_manager' },
  { label: 'Project Manager', value: 'project_manager' },
  { label: 'Project Co-ordinator', value: 'project_coordinator' },
  { label: 'Employee', value: 'employee' },
];

export default function EmployeeEditModal({ visible, user, onClose, onSave }: Props) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>('employee');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [panCard, setPanCard] = useState('');
  const [aadharCard, setAadharCard] = useState('');
  const [panPhoto, setPanPhoto] = useState<string | null>(null);
  const [aadharPhoto, setAadharPhoto] = useState<string | null>(null);
  const [aadharBackPhoto, setAadharBackPhoto] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when user changes
  React.useEffect(() => {
    if (user) {
      setIsActive(user.isActive);
      setRole(user.role);
      setEmail(user.email || '');
      setUsername(user.username || '');
      setDateOfBirth(user.dateOfBirth || '');
      setPanCard(user.panCard || '');
      setAadharCard(user.aadharCard || '');
      setPanPhoto(user.panCardPhotoUrl || null);
      setAadharPhoto(user.aadharCardPhotoUrl || null);
      setAadharBackPhoto(user.aadharCardBackPhotoUrl || null);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Email and Username are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(user.uid, {
        isActive,
        role,
        email: email.trim(),
        username: username.trim(),
        dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : null,
        panCard: panCard.trim() ? panCard.trim().toUpperCase() : null,
        aadharCard: aadharCard.trim() ? aadharCard.trim() : null,
        panCardPhotoUrl: panPhoto,
        aadharCardPhotoUrl: aadharPhoto,
        aadharCardBackPhotoUrl: aadharBackPhoto
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const pickImage = async (type: 'pan' | 'aadharFront' | 'aadharBack') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload documents.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const compressedBase64 = await compressImageToBase64(uri);
        
        if (type === 'pan') setPanPhoto(compressedBase64);
        if (type === 'aadharFront') setAadharPhoto(compressedBase64);
        if (type === 'aadharBack') setAadharBackPhoto(compressedBase64);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to pick image.');
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
                <Text style={styles.email}>@{user.username}</Text>
                {user.phoneNumber && <Text style={styles.email}>{user.phoneNumber}</Text>}
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: Colors.text.tertiary }]}
                  value={email}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
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
            </View>

            {/* Date of Birth Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.inputBox}>
                  <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} />
                  <input
                    type="date"
                    value={dateOfBirth ? dateOfBirth.split('-').reverse().join('-') : ''}
                    onChange={(e) => {
                      const val = e.target.value; // YYYY-MM-DD
                      if (val) {
                        const [y, m, d] = val.split('-');
                        setDateOfBirth(`${d}-${m}-${y}`);
                      } else {
                        setDateOfBirth('');
                      }
                    }}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: 14,
                      color: Colors.text.primary,
                      fontFamily: 'inherit',
                      paddingTop: 12,
                      paddingBottom: 12,
                      marginLeft: 12,
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.inputBox}
                    onPress={() => setShowDatePicker(true)}
                    disabled={isSaving}
                  >
                    <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} />
                    <Text style={[styles.input, { color: dateOfBirth ? Colors.text.primary : Colors.text.tertiary }]}>
                      {dateOfBirth || 'DD-MM-YYYY'}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={dateOfBirth ? new Date(dateOfBirth.split('-').reverse().join('-')) : new Date()}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={(event, date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (date) {
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          setDateOfBirth(`${day}-${month}-${year}`);
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>

            {/* PAN Card Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>PAN Card Number</Text>
              <View style={styles.inputBox}>
                <Ionicons name="card-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ABCDE1234F"
                  value={panCard}
                  onChangeText={setPanCard}
                  autoCapitalize="characters"
                  maxLength={10}
                  editable={!isSaving}
                />
              </View>
              <TouchableOpacity style={styles.photoUploadBtn} onPress={() => pickImage('pan')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: panPhoto ? Spacing.sm : 0 }}>
                  <Ionicons name={panPhoto ? "checkmark-circle" : "image-outline"} size={20} color={panPhoto ? Colors.success : Colors.primary} />
                  <Text style={[styles.photoUploadTxt, { color: panPhoto ? Colors.success : Colors.primary }]}>
                    {panPhoto ? 'PAN Photo Added (Tap to change)' : 'Upload PAN Photo'}
                  </Text>
                </View>
                {panPhoto && (
                  <Image source={{ uri: panPhoto }} style={{ width: '100%', height: 120, borderRadius: 6, backgroundColor: '#f0f0f0' }} resizeMode="contain" />
                )}
              </TouchableOpacity>
            </View>

            {/* Aadhar Card Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Aadhar Card Number</Text>
              <View style={styles.inputBox}>
                <Ionicons name="finger-print-outline" size={20} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123456789012"
                  value={aadharCard}
                  onChangeText={setAadharCard}
                  keyboardType="numeric"
                  maxLength={12}
                  editable={!isSaving}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity style={[styles.photoUploadBtn, { flex: 1 }]} onPress={() => pickImage('aadharFront')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: aadharPhoto ? Spacing.sm : 0 }}>
                    <Ionicons name={aadharPhoto ? "checkmark-circle" : "image-outline"} size={20} color={aadharPhoto ? Colors.success : Colors.primary} />
                    <Text style={[styles.photoUploadTxt, { color: aadharPhoto ? Colors.success : Colors.primary }]}>
                      {aadharPhoto ? 'Front Added' : 'Upload Front'}
                    </Text>
                  </View>
                  {aadharPhoto && (
                    <Image source={{ uri: aadharPhoto }} style={{ width: '100%', height: 80, borderRadius: 6, backgroundColor: '#f0f0f0' }} resizeMode="contain" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.photoUploadBtn, { flex: 1 }]} onPress={() => pickImage('aadharBack')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: aadharBackPhoto ? Spacing.sm : 0 }}>
                    <Ionicons name={aadharBackPhoto ? "checkmark-circle" : "image-outline"} size={20} color={aadharBackPhoto ? Colors.success : Colors.primary} />
                    <Text style={[styles.photoUploadTxt, { color: aadharBackPhoto ? Colors.success : Colors.primary }]}>
                      {aadharBackPhoto ? 'Back Added' : 'Upload Back'}
                    </Text>
                  </View>
                  {aadharBackPhoto && (
                    <Image source={{ uri: aadharBackPhoto }} style={{ width: '100%', height: 80, borderRadius: 6, backgroundColor: '#f0f0f0' }} resizeMode="contain" />
                  )}
                </TouchableOpacity>
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
                {ROLES.filter(r => {
                  const currentUser = useAuthStore.getState().user;
                  if (currentUser?.role === 'hr_manager') {
                    // HR Manager can ONLY assign the 'employee' role
                    return r.value === 'employee';
                  }
                  return true;
                }).map((r) => {
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
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
  },
  input: Platform.select({
    web: {
      flex: 1,
      paddingVertical: Spacing.md,
      marginLeft: Spacing.sm,
      fontSize: FontSize.md,
      color: Colors.text.primary,
      outlineStyle: 'none',
    } as any,
    default: {
      flex: 1,
      paddingVertical: Spacing.md,
      marginLeft: Spacing.sm,
      fontSize: FontSize.md,
      color: Colors.text.primary,
    }
  }),
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
  roleTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  photoUploadBtn: {
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  photoUploadTxt: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
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
