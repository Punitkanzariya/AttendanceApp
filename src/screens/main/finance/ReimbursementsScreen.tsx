import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllExpenses } from '@/firebase/expenseService';
import type { ExpenseRequest } from '@/types';

export default function ReimbursementsScreen() {
  const [reimbursedExpenses, setReimbursedExpenses] = useState<ExpenseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [isAttachmentVisible, setIsAttachmentVisible] = useState(false);

  useEffect(() => {
    // Only fetch reimbursed expenses
    const unsubscribe = subscribeToAllExpenses(['reimbursed'], (data) => {
      setReimbursedExpenses(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
      });
    }
  };

  const renderItem = ({ item }: { item: ExpenseRequest }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => setSelectedExpense(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.rowStart}>
          <View style={[styles.iconRing, { backgroundColor: Colors.success + '15' }]}>
            <Ionicons name="checkmark-done" size={18} color={Colors.success} />
          </View>
          <View>
            <Text style={styles.empName}>{item.employeeName}</Text>
            <Text style={styles.categoryText}>{item.category} • {item.date}</Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>PAID</Text>
        </View>
      </View>
      
      <Text style={styles.amountText}>₹{item.amount}</Text>
      
      {item.attachmentUrl && (
        <View style={styles.attachmentBadge}>
          <Ionicons name="document-attach-outline" size={14} color={Colors.text.secondary} />
          <Text style={styles.attachmentText}>Receipt Attached</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const totalReimbursed = reimbursedExpenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reimbursement Ledger</Text>
        <Text style={styles.headerSubtitle}>History of all processed payments</Text>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Total Reimbursed</Text>
        <Text style={styles.summaryValue}>₹{totalReimbursed.toLocaleString()}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reimbursedExpenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No reimbursements processed yet</Text>
            </View>
          }
        />
      )}

      {/* Details Modal */}
      <Modal visible={!!selectedExpense} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reimbursement Details</Text>
              <TouchableOpacity onPress={() => setSelectedExpense(null)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedExpense && (
              <View style={styles.modalScroll}>
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.successBannerText}>Successfully Paid</Text>
                </View>

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
                </View>

                <Text style={styles.detailLabel}>Description:</Text>
                <Text style={styles.detailValue}>{selectedExpense.description}</Text>

                {selectedExpense.attachmentUrl && (
                  <TouchableOpacity style={styles.viewBillBtn} onPress={() => openAttachment(selectedExpense.attachmentUrl!)}>
                    <Ionicons name="open-outline" size={16} color={Colors.primary} />
                    <Text style={styles.viewBillText}>View Original Bill</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  headerSubtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4 },
  
  summaryBox: { margin: Spacing.lg, padding: Spacing.xl, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, ...Shadow.md, alignItems: 'center' },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm, fontWeight: '600', marginBottom: 4 },
  summaryValue: { color: Colors.white, fontSize: 32, fontWeight: 'bold' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.md },
  
  card: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.lg, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  rowStart: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconRing: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary },
  categoryText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.text.secondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.success + '20' },
  statusText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.success },
  amountText: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary, marginBottom: Spacing.sm },
  attachmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: Spacing.md },
  attachmentText: { fontSize: 11, color: Colors.text.secondary },
  
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalScroll: { marginBottom: Spacing.lg },
  
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.success + '15', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
  successBannerText: { color: Colors.success, fontWeight: 'bold', fontSize: FontSize.md },

  detailLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginBottom: 2 },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.md },
  
  viewBillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: '#BFDBFE', justifyContent: 'center' },
  viewBillText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
});
