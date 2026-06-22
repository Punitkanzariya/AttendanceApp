import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllExpenses, updateExpenseStatus } from '@/firebase/expenseService';
import type { ExpenseRequest, ExpenseStatus } from '@/types';

export default function SupervisorExpenseScreen() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_supervisor');

  // Review Modal State
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAttachmentVisible, setIsAttachmentVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAllExpenses(
      ['pending_supervisor', 'pending_manager', 'pending_finance', 'reimbursed', 'rejected'],
      (data) => {
        setExpenses(data);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredExpenses = useMemo(() => {
    if (filter === 'all') return expenses;
    if (filter === 'approved') return expenses.filter(e => e.status === 'pending_manager' || e.status === 'pending_finance' || e.status === 'reimbursed');
    return expenses.filter(e => e.status === filter);
  }, [expenses, filter]);

  const handleReviewAction = async (status: ExpenseStatus) => {
    if (!selectedExpense || !user?.uid) return;
    
    if (status === 'rejected' && !reviewNotes.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection.');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Supervisor approval moves it to pending_manager
      const newStatus = status === 'pending_manager' ? 'pending_manager' : 'rejected';
      await updateExpenseStatus(selectedExpense.id, newStatus, user.uid, reviewNotes);
      setSelectedExpense(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Failed to update expense:', error);
      Alert.alert('Error', 'Failed to update expense status');
    } finally {
      setIsProcessing(false);
    }
  };

  const openReviewModal = (expense: ExpenseRequest) => {
    setSelectedExpense(expense);
    setReviewNotes(expense.rejectionReason || '');
  };

  const openAttachment = (url: string) => {
    if (url.startsWith('data:image')) {
      setIsAttachmentVisible(true);
    } else if (Platform.OS === 'web') {
      const win = window.open();
      if (win) {
        win.document.write('<iframe src="' + url  + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
      }
    } else {
      Linking.openURL(url).catch((err) => {
        console.error('Failed to open URL:', err);
        Alert.alert('Error', 'Could not open the attachment.');
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_manager': return Colors.success;
      case 'pending_finance': return Colors.success;
      case 'reimbursed': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.warning;
    }
  };

  const renderItem = ({ item }: { item: ExpenseRequest }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => item.status === 'pending_supervisor' ? openReviewModal(item) : null}
    >
      <View style={styles.cardHeader}>
        <View style={styles.rowStart}>
          <View style={styles.iconRing}>
            <Ionicons 
              name={item.category === 'Travel' ? 'car-outline' : item.category === 'Meals' ? 'restaurant-outline' : 'cart-outline'} 
              size={18} 
              color={Colors.primary} 
            />
          </View>
          <View>
            <Text style={styles.empName}>{item.employeeName}</Text>
            <Text style={styles.categoryText}>{item.category} • {item.date}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.amountText}>₹{item.amount}</Text>
      
      <Text style={styles.reasonLabel}>Description:</Text>
      <Text style={styles.reasonText} numberOfLines={2}>{item.description}</Text>

      {item.attachmentUrl && (
        <View style={styles.attachmentBadge}>
          <Ionicons name="document-attach-outline" size={14} color={Colors.text.secondary} />
          <Text style={styles.attachmentText}>Receipt Attached</Text>
        </View>
      )}

      {item.status === 'pending_supervisor' && (
        <Text style={styles.actionHint}>Tap to Review &rarr;</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Verify Site Expenses</Text>
      </View>

      <View style={styles.filterRow}>
        {(['pending_supervisor', 'approved', 'rejected', 'all'] as const).map(f => (
          <TouchableOpacity 
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>
              {f === 'pending_supervisor' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            {f === 'pending_supervisor' && expenses.filter(e => e.status === 'pending_supervisor').length > 0 && (
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
          data={filteredExpenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} expense requests found</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedExpense} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Expense</Text>
              <TouchableOpacity onPress={() => setSelectedExpense(null)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedExpense && (
              <>
                <View style={styles.modalScroll}>
                  <Text style={styles.detailLabel}>Employee:</Text>
                  <Text style={styles.detailValue}>{selectedExpense.employeeName}</Text>
                  
                  <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
                    <View>
                      <Text style={styles.detailLabel}>Amount:</Text>
                      <Text style={[styles.detailValue, { fontSize: FontSize.lg, color: Colors.primary }]}>₹{selectedExpense.amount}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Date:</Text>
                      <Text style={styles.detailValue}>{selectedExpense.date}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Category:</Text>
                      <Text style={styles.detailValue}>{selectedExpense.category}</Text>
                    </View>
                  </View>

                  <Text style={styles.detailLabel}>Description:</Text>
                  <Text style={styles.detailValue}>{selectedExpense.description}</Text>

                  {selectedExpense.attachmentUrl && (
                    <TouchableOpacity style={styles.viewBillBtn} onPress={() => openAttachment(selectedExpense.attachmentUrl!)}>
                      <Ionicons name="open-outline" size={16} color={Colors.primary} />
                      <Text style={styles.viewBillText}>View Attached Bill</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.inputLabel}>Rejection / Review Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Provide reason if rejecting..."
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

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
                    onPress={() => handleReviewAction('pending_manager')}
                    disabled={isProcessing}
                  >
                    <Text style={styles.actionBtnText}>Verify & Approve</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isAttachmentVisible} transparent={true} animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setIsAttachmentVisible(false)}>
            <Ionicons name="close-circle" size={36} color={Colors.white} />
          </TouchableOpacity>
          {selectedExpense?.attachmentUrl && (
            <Image 
              source={{ uri: selectedExpense.attachmentUrl }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.xl, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  filterTab: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.full, backgroundColor: Colors.background },
  filterTabActive: { backgroundColor: Colors.primary },
  filterTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  filterTxtActive: { color: Colors.white },
  notificationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error, marginLeft: 4, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: Spacing.lg, gap: Spacing.md },
  card: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.lg, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  rowStart: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconRing: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  empName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary },
  categoryText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: FontWeight.bold },
  amountText: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary, marginBottom: Spacing.sm },
  reasonLabel: { fontSize: FontSize.xs, color: Colors.text.tertiary },
  reasonText: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2 },
  attachmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: Spacing.md },
  attachmentText: { fontSize: 11, color: Colors.text.secondary },
  actionHint: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: Spacing.md, textAlign: 'right' },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalScroll: { marginBottom: Spacing.lg },
  detailLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginBottom: 2 },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.md },
  viewBillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#BFDBFE', justifyContent: 'center' },
  viewBillText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text.primary },
  textArea: { height: 80, marginBottom: Spacing.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
});
