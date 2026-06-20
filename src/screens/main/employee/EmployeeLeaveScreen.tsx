import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform, createElement } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../../theme';
import { subscribeToUserLeaves, submitLeaveRequest } from '../../../firebase/leaveService';
import type { LeaveRequest } from '../../../types';

const DateInput = ({ value, onChangeText, placeholder, min }: { value: string, onChangeText: (t: string) => void, placeholder: string, min?: string }) => {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value: value,
      min: min,
      onChange: (e: any) => onChangeText(e.target.value),
      style: {
        width: '100%',
        padding: '12px',
        fontSize: '16px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        marginBottom: '24px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        color: '#111827'
      }
    });
  }

  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
    />
  );
};

export default function EmployeeLeaveScreen() {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get today's date in YYYY-MM-DD for the min attribute
  const todayDate = new Date().toISOString().split('T')[0];

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribe = subscribeToUserLeaves(user.uid, (data) => {
      setLeaves(data);
      setIsLoading(false);
    });

    // We can't directly pass an error callback to our custom hook easily without modifying it, 
    // but the local sort fix in leaveService will prevent the index error.
    // As a fallback timeout:
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user?.uid]);

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    const days = calculateDays(startDate, endDate);
    if (days <= 0) {
      Alert.alert('Error', 'End date must be on or after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLeaveRequest(
        user!.uid,
        user!.displayName || 'Unknown Employee',
        leaveType,
        startDate,
        endDate,
        days,
        reason
      );
      setIsModalVisible(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setLeaveType('Casual Leave');
    } catch (error) {
      console.error('Failed to submit leave:', error);
      Alert.alert('Error', 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.warning;
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.leaveTypeText}>{item.leaveType || 'Leave'}</Text>
          <Text style={styles.dateText}>{item.startDate} to {item.endDate} ({item.totalDays || 1} Days)</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.reasonLabel}>Reason:</Text>
      <Text style={styles.reasonText}>{item.reason}</Text>
      {item.reviewNotes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Manager Notes:</Text>
          <Text style={styles.notesText}>{item.reviewNotes}</Text>
        </View>
      )}
      <Text style={styles.appliedDate}>Applied: {new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Leaves</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No leave history found</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={Colors.white} />
        <Text style={styles.fabText}>Apply Leave</Text>
      </TouchableOpacity>

      {/* Apply Leave Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Leave Type</Text>
            <View style={styles.typeSelectorRow}>
              {['Casual Leave', 'Sick Leave', 'Paid Leave'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, leaveType === type && styles.typeButtonActive]}
                  onPress={() => setLeaveType(type)}
                >
                  <Text style={[styles.typeButtonText, leaveType === type && styles.typeButtonTextActive]}>
                    {type.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Start Date</Text>
            <DateInput
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              min={todayDate}
            />

            <Text style={styles.inputLabel}>End Date</Text>
            <DateInput
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              min={todayDate}
            />
            
            {startDate && endDate && calculateDays(startDate, endDate) > 0 && (
               <Text style={styles.totalDaysPreview}>
                 Total Duration: {calculateDays(startDate, endDate)} Days
               </Text>
            )}

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why are you requesting leave?"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  leaveTypeText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: 2 },
  dateText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 10, fontWeight: FontWeight.bold },
  reasonLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: Spacing.sm },
  reasonText: { fontSize: FontSize.md, color: Colors.text.primary, marginTop: 4 },
  notesContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
  },
  notesLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.text.secondary },
  notesText: { fontSize: FontSize.sm, color: Colors.text.primary, marginTop: 4 },
  appliedDate: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: Spacing.md, textAlign: 'right' },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
  
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    ...Shadow.md,
  },
  fabText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginBottom: Spacing.xs },
  
  typeSelectorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeButton: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  typeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  typeButtonTextActive: { color: Colors.white, fontWeight: FontWeight.bold },
  
  totalDaysPreview: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, marginBottom: Spacing.lg, textAlign: 'right' },
  
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
    color: Colors.text.primary,
  },
  textArea: {
    height: 100,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
