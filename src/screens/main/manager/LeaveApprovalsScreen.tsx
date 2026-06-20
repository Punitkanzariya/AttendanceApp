import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllLeaves, updateLeaveStatus } from '@/firebase/leaveService';
import type { LeaveRequest, LeaveStatus } from '@/types';

export default function LeaveApprovalsScreen() {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending');

  // Review Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAllLeaves((data) => {
      setLeaves(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLeaves = useMemo(() => {
    if (filter === 'all') return leaves;
    return leaves.filter(l => l.status === filter);
  }, [leaves, filter]);

  const handleReviewAction = async (status: LeaveStatus) => {
    if (!selectedLeave || !user?.uid) return;
    
    setIsProcessing(true);
    try {
      await updateLeaveStatus(selectedLeave.id, status, user.uid, reviewNotes);
      setSelectedLeave(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Failed to update leave:', error);
      Alert.alert('Error', 'Failed to update leave status');
    } finally {
      setIsProcessing(false);
    }
  };

  const openReviewModal = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setReviewNotes(leave.reviewNotes || '');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.warning;
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => item.status === 'pending' ? openReviewModal(item) : null}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.empName}>{item.employeeName}</Text>
          <Text style={styles.leaveTypeText}>{item.leaveType || 'Leave'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color={Colors.text.secondary} />
        <Text style={styles.dateText}>{item.startDate}  to  {item.endDate} ({item.totalDays || 1} Days)</Text>
      </View>
      
      <Text style={styles.reasonLabel}>Reason:</Text>
      <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>

      {item.status === 'pending' && (
        <Text style={styles.actionHint}>Tap to Review &rarr;</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave Approvals</Text>
      </View>

      <View style={styles.filterRow}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <TouchableOpacity 
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            {f === 'pending' && leaves.filter(l => l.status === 'pending').length > 0 && (
              <View style={styles.notificationDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredLeaves}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} leave requests found</Text>
            </View>
          }
        />
      )}

      {/* Review Modal */}
      <Modal visible={!!selectedLeave} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Leave</Text>
              <TouchableOpacity onPress={() => setSelectedLeave(null)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedLeave && (
              <>
                <Text style={styles.detailLabel}>Employee:</Text>
                <Text style={styles.detailValue}>{selectedLeave.employeeName}</Text>
                
                <Text style={styles.detailLabel}>Dates:</Text>
                <Text style={styles.detailValue}>{selectedLeave.startDate} to {selectedLeave.endDate} ({selectedLeave.totalDays || 1} Days)</Text>
                
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{selectedLeave.leaveType || 'Standard Leave'}</Text>

                <Text style={styles.detailLabel}>Reason:</Text>
                <Text style={styles.detailValue}>{selectedLeave.reason}</Text>

                <Text style={styles.inputLabel}>Manager Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add notes for the employee..."
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                    onPress={() => handleReviewAction('rejected')}
                    disabled={isProcessing}
                  >
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: Colors.success }]} 
                    onPress={() => handleReviewAction('approved')}
                    disabled={isProcessing}
                  >
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
  },
  filterTabActive: { backgroundColor: Colors.primary },
  filterTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  filterTxtActive: { color: Colors.white },
  notificationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error, marginLeft: 4, marginTop: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: Spacing.lg, gap: Spacing.md },
  
  card: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  empName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary },
  leaveTypeText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: FontWeight.bold },
  
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  dateText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  
  reasonLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginTop: Spacing.xs },
  reasonText: { fontSize: FontSize.md, color: Colors.text.primary, marginTop: 2 },
  
  actionHint: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: Spacing.md, textAlign: 'right' },

  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  
  detailLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginBottom: 2 },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text.primary, marginBottom: Spacing.md },
  
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text.primary },
  textArea: { height: 80, marginBottom: Spacing.xl },
  
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
