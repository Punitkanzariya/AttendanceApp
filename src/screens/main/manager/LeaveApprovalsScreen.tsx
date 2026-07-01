import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { formatDisplayStatus } from '@/utils/statusUtils';
import { formatLeaveDurationText } from '@/utils/dateUtils';
import { subscribeToLeavesForRole, updateLeaveStatus, getNextLeaveStatus } from '@/firebase/leaveService';
import type { LeaveRequest, LeaveStatus } from '@/types';

export default function LeaveApprovalsScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending');
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);

  // Review Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToLeavesForRole(user.role, user.uid, (data) => {
      setLeaves(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-switch filter to 'all' if no pending leaves are found on initial load
  useEffect(() => {
    if (!isLoading && !hasAutoSwitched) {
      let pendingCount = 0;
      if (user?.role === 'project_coordinator') {
        pendingCount = leaves.filter(l => l.status === 'pending_coordinator').length;
      } else if (user?.role === 'project_manager') {
        pendingCount = leaves.filter(l => l.status === 'pending_manager').length;
      } else {
        pendingCount = leaves.filter(l => l.status === 'pending_hr' || l.status === 'pending').length;
      }

      if (pendingCount === 0) {
        setFilter('all');
      }
      setHasAutoSwitched(true);
    }
  }, [leaves, isLoading, hasAutoSwitched]);

  const filteredLeaves = useMemo(() => {
    if (filter === 'all') return leaves;
    if (filter === 'pending') {
      if (user?.role === 'project_coordinator') return leaves.filter(l => l.status === 'pending_coordinator');
      if (user?.role === 'project_manager') return leaves.filter(l => l.status === 'pending_manager');
      return leaves.filter(l => l.status === 'pending_hr' || l.status === 'pending');
    }
    if (filter === 'approved') {
      if (user?.role === 'project_coordinator') return leaves.filter(l => l.status === 'pending_manager' || l.status === 'pending_hr' || l.status === 'approved');
      if (user?.role === 'project_manager') return leaves.filter(l => l.status === 'pending_hr' || l.status === 'approved');
      return leaves.filter(l => l.status === 'approved');
    }
    return leaves.filter(l => l.status === filter);
  }, [leaves, filter, user?.role]);

  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!selectedLeave || !user?.uid) return;
    
    setIsProcessing(true);
    try {
      let newStatus: LeaveStatus = selectedLeave.status;
      if (action === 'reject') {
        newStatus = 'rejected';
      } else {
        newStatus = getNextLeaveStatus(selectedLeave, user.role);
      }

      await updateLeaveStatus(selectedLeave.id, selectedLeave.employeeId, selectedLeave.role, newStatus, user.uid, reviewNotes);
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
    if (status.includes('pending')) return Colors.warning;
    if (status === 'approved' || status === 'reimbursed' || status === 'verified') return Colors.success;
    if (status === 'rejected') return Colors.error;
    return Colors.text.tertiary;
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => openReviewModal(item)}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.empName}>{item.employeeName}</Text>
          <Text style={styles.leaveTypeText}>{item.leaveType || 'Leave'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatDisplayStatus(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color={Colors.text.secondary} />
        <Text style={styles.dateText}>
          {formatLeaveDurationText(item.startDate, item.endDate, item.totalDays, item.durationType, item.halfDayPeriod)}
        </Text>
      </View>
      
      <Text style={styles.reasonLabel}>Reason:</Text>
      <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>

      {(() => {
        const isMyTurn = user?.role === 'project_coordinator' 
          ? item.status === 'pending_coordinator' 
          : user?.role === 'project_manager' 
            ? item.status === 'pending_manager' 
            : item.status === 'pending_hr' || item.status === 'pending';

        if (isMyTurn) {
          return <Text style={styles.actionHint}>Tap to Review &rarr;</Text>;
        } else if (item.status === 'rejected') {
          return <Text style={[styles.actionHint, { color: Colors.error }]}>View Rejection Details &rarr;</Text>;
        } else if (item.status === 'approved') {
          return <Text style={[styles.actionHint, { color: Colors.success }]}>View Approved Leave &rarr;</Text>;
        } else {
          return <Text style={[styles.actionHint, { color: Colors.success }]}>Verified & Forwarded &rarr;</Text>;
        }
      })()}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave Approvals</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterTxt, filter === 'pending' && styles.filterTxtActive]}>
            Pending
          </Text>
          {leaves.filter(l => l.status === (user?.role === 'project_coordinator' ? 'pending_coordinator' : user?.role === 'project_manager' ? 'pending_manager' : 'pending_hr')).length > 0 && (
            <View style={styles.notificationDot} />
          )}
        </TouchableOpacity>
        
        {(['approved', 'rejected', 'all'] as const).map(f => (
          <TouchableOpacity 
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
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
              <Text style={styles.emptyText}>No leaves found for this filter</Text>
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
                <Text style={styles.detailValue}>
                  {formatLeaveDurationText(selectedLeave.startDate, selectedLeave.endDate, selectedLeave.totalDays, selectedLeave.durationType, selectedLeave.halfDayPeriod)}
                </Text>
                
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{selectedLeave.leaveType || 'Standard Leave'}</Text>

                <Text style={styles.detailLabel}>Reason:</Text>
                <Text style={styles.detailValue}>{selectedLeave.reason}</Text>

                {(() => {
                  const isMyTurn = user?.role === 'project_coordinator' 
                    ? selectedLeave.status === 'pending_coordinator' 
                    : user?.role === 'project_manager' 
                      ? selectedLeave.status === 'pending_manager' 
                      : selectedLeave.status === 'pending_hr' || selectedLeave.status === 'pending';
                  
                  if (!isMyTurn) return null;

                  return (
                    <>
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
                          style={[styles.actionBtn, { backgroundColor: Colors.success }]} 
                          onPress={() => handleReviewAction('approve')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.actionBtnText}>
                            {user?.role === 'project_coordinator' ? 'Approve & Forward' : user?.role === 'project_manager' ? 'Approve & Forward to HR' : 'Approve'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.actionBtnOutline, { borderColor: Colors.error }]} 
                          onPress={() => handleReviewAction('reject')}
                          disabled={isProcessing}
                        >
                          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  header: {
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
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
  
  actionRow: { flexDirection: 'column', gap: Spacing.md, marginTop: Spacing.sm },
  actionBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnOutline: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md, textAlign: 'center' },
});
