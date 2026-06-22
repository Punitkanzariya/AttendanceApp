import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import * as DocumentPicker from 'expo-document-picker';
import { 
  subscribeToUserExpenses, 
  submitExpenseRequest, 
  updateExpenseRequest, 
  checkDuplicateExpense,
  saveExpenseDraft,
  getExpenseDraft,
  clearExpenseDraft
} from '@/firebase/expenseService';
import type { ExpenseRequest, ExpenseStatus } from '@/types';

export default function EmployeeExpenseScreen() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Travel');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<{ uri: string, name: string } | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    
    // Fetch real-time expenses
    const unsubscribe = subscribeToUserExpenses(user.uid, (data) => {
      setExpenses(data);
      setIsLoading(false);
    });

    // Load Draft
    const loadDraft = async () => {
      const draft = await getExpenseDraft();
      if (draft) {
        if (draft.amount) setAmount(draft.amount.toString());
        if (draft.category) setCategory(draft.category);
        if (draft.description) setDescription(draft.description);
        if (draft.date) setDate(draft.date);
        // Note: We typically don't restore local file URIs as they might be ephemeral
      }
    };
    loadDraft();

    return () => unsubscribe();
  }, [user?.uid]);

  // Save draft whenever form changes (if not editing an existing one)
  useEffect(() => {
    if (!editingId && (amount || description)) {
      saveExpenseDraft({
        amount: parseFloat(amount) || 0,
        category,
        description,
        date
      });
    }
  }, [amount, category, description, date, editingId]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachment({
          uri: result.assets[0].uri,
          name: result.assets[0].name
        });
      }
    } catch (err) {
      console.error("Error picking document", err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleOpenModalForNew = () => {
    setEditingId(null);
    setExistingAttachmentUrl(null);
    setAttachment(null);
    setIsModalVisible(true);
  };

  const handleOpenModalForEdit = (expense: ExpenseRequest) => {
    setEditingId(expense.id);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setDescription(expense.description);
    setExistingAttachmentUrl(expense.attachmentUrl || null);
    setAttachment(null);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    if (editingId) {
      // If we were editing, reset to draft or blank
      setEditingId(null);
      setAmount('');
      setDescription('');
      setAttachment(null);
    }
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateExpenseRequest(
          editingId,
          user!.uid,
          category,
          parseFloat(amount),
          date,
          description,
          attachment?.uri || null,
          existingAttachmentUrl
        );
      } else {
        await submitExpenseRequest(
          user!.uid,
          user!.displayName || 'Employee',
          category,
          parseFloat(amount),
          date,
          description,
          attachment?.uri || null
        );
      }
      
      handleCloseModal();
      setAmount('');
      setDescription('');
      setAttachment(null);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !description || !date) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Amount must be a valid number');
      return;
    }

    if (!editingId) {
      // Check for duplicates
      const isDuplicate = await checkDuplicateExpense(
        user!.uid, 
        parseFloat(amount), 
        date, 
        category
      );

      if (isDuplicate) {
        Alert.alert(
          'Duplicate Detected',
          'An expense with the same amount, date, and category already exists. Are you sure you want to submit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit Anyway', onPress: executeSubmit }
          ]
        );
        return;
      }
    }

    executeSubmit();
  };

  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case 'reimbursed': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.warning;
    }
  };

  const renderItem = ({ item }: { item: ExpenseRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryWrap}>
          <View style={styles.iconRing}>
            <Ionicons 
              name={
                item.category === 'Travel' ? 'car-outline' :
                item.category === 'Meals' ? 'restaurant-outline' :
                item.category === 'Fuel' ? 'speedometer-outline' :
                item.category === 'Supplies' ? 'briefcase-outline' :
                'cart-outline'
              } 
              size={18} 
              color={Colors.primary} 
            />
          </View>
          <View>
            <Text style={styles.expenseCategory}>{item.category}</Text>
            <Text style={styles.expenseDate}>{item.date}</Text>
          </View>
        </View>
        <Text style={styles.expenseAmount}>₹{item.amount}</Text>
      </View>

      <Text style={styles.descriptionText}>{item.description}</Text>

      {item.attachmentUrl && (
        <View style={styles.attachmentBadge}>
          <Ionicons name="document-attach-outline" size={14} color={Colors.text.secondary} />
          <Text style={styles.attachmentText}>Receipt Attached</Text>
        </View>
      )}

      {item.status === 'rejected' && item.rejectionReason && (
        <View style={styles.rejectionBox}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15', borderColor: getStatusColor(item.status) + '40' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        
        {item.status === 'rejected' && (
          <TouchableOpacity 
            style={styles.resubmitBtn}
            onPress={() => handleOpenModalForEdit(item)}
          >
            <Ionicons name="pencil" size={14} color={Colors.primary} />
            <Text style={styles.resubmitBtnText}>Edit & Resubmit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderHeader = () => {
    const totalPending = expenses.filter(e => e.status.startsWith('pending')).reduce((sum, e) => sum + e.amount, 0);
    const totalApproved = expenses.filter(e => e.status === 'reimbursed').reduce((sum, e) => sum + e.amount, 0);

    return (
      <View style={styles.headerContent}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderTopColor: Colors.warning }]}>
            <Text style={styles.summaryLabel}>Pending Claim</Text>
            <Text style={[styles.summaryAmount, { color: Colors.warning }]}>₹{totalPending}</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.success }]}>
            <Text style={styles.summaryLabel}>Approved</Text>
            <Text style={[styles.summaryAmount, { color: Colors.success }]}>₹{totalApproved}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No expenses found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleOpenModalForNew}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={Colors.white} />
        <Text style={styles.fabText}>Add Expense</Text>
      </TouchableOpacity>

      {/* Add/Edit Expense Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Expense' : 'New Expense'}</Text>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.typeSelectorRow}>
                {['Travel', 'Meals', 'Fuel', 'Supplies', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, category === type && styles.typeButtonActive]}
                    onPress={() => setCategory(type)}
                  >
                    <Text style={[styles.typeButtonText, category === type && styles.typeButtonTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1500"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    marginBottom: 24,
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                />
              )}

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What was this expense for?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Attachment (Optional)</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                <Text style={styles.uploadBtnText}>
                  {attachment ? attachment.name : (existingAttachmentUrl ? 'Replace existing bill' : 'Upload Bill (PDF/JPG)')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>{editingId ? 'Resubmit Expense' : 'Submit Expense'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 25, fontWeight: '700', color: Colors.text.primary, lineHeight: 34 },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  headerContent: { marginBottom: Spacing.md },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
  
  summaryGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  summaryCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 4 },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: 22, fontWeight: 'bold' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  
  card: { backgroundColor: Colors.white, padding: 16, borderRadius: 16, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  categoryWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconRing: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  expenseCategory: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  expenseDate: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  expenseAmount: { fontSize: 18, fontWeight: 'bold', color: Colors.text.primary },
  
  descriptionText: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.sm },
  
  attachmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: Spacing.md },
  attachmentText: { fontSize: 11, color: Colors.text.secondary },
  
  rejectionBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#FECACA' },
  rejectionText: { fontSize: 12, color: Colors.error, flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  resubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  resubmitBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.xl, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, gap: Spacing.sm },
  fabText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '90%' },
  scrollContent: { padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginBottom: Spacing.xs },
  typeSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeButton: { paddingHorizontal: 12, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, minWidth: '28%' },
  typeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  typeButtonTextActive: { color: Colors.white, fontWeight: FontWeight.bold },
  
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, marginBottom: Spacing.lg, color: Colors.text.primary },
  textArea: { height: 80 },
  
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.lg, backgroundColor: '#EFF6FF' },
  uploadBtnText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },

  submitBtn: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md },
  submitBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
