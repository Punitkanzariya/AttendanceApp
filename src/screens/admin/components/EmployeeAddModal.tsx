import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import type { UserRole } from '@/types';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToBase64 } from '@/utils/imageUtils';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (user: { fullName: string; email: string; username: string; phone: string; role: UserRole; password?: string; dateOfBirth?: string; panCard?: string; aadharCard?: string; panCardPhotoUrl?: string | null; aadharCardPhotoUrl?: string | null; aadharCardBackPhotoUrl?: string | null; }) => Promise<void>;
  isSaving?: boolean;
}

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Administrator', value: 'administrator' },
  { label: 'Finance', value: 'finance' },
  { label: 'HR Manager', value: 'hr_manager' },
  { label: 'Project Manager', value: 'project_manager' },
  { label: 'Project Co-ordinator', value: 'project_coordinator' },
  { label: 'Employee', value: 'employee' },
];

export default function EmployeeAddModal({ visible, onClose, onAdd }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [panCard, setPanCard] = useState('');
  const [aadharCard, setAadharCard] = useState('');
  const [panPhoto, setPanPhoto] = useState<string | null>(null);
  const [aadharPhoto, setAadharPhoto] = useState<string | null>(null);
  const [aadharBackPhoto, setAadharBackPhoto] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      setDateOfBirth('');
      setPanCard('');
      setAadharCard('');
      setPanPhoto(null);
      setAadharPhoto(null);
      setAadharBackPhoto(null);
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
        dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : undefined,
        panCard: panCard.trim() ? panCard.trim().toUpperCase() : undefined,
        aadharCard: aadharCard.trim() ? aadharCard.trim() : undefined,
        panCardPhotoUrl: panPhoto,
        aadharCardPhotoUrl: aadharPhoto,
        aadharCardBackPhotoUrl: aadharBackPhoto,
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
                      height: '100%',
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
  roleTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  photoUploadBtn: {
    padding: Spacing.sm,
    marginBottom: Spacing.md,
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
