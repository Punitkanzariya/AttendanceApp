import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Image,
  Platform,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from "@/theme";
import { formatDisplayStatus } from "@/utils/statusUtils";
import { useAuthStore } from "@/store/authStore";
import { subscribeToUserExpenses } from "@/firebase/expenseService";
import type { Expense } from "@/types";
import { ExpenseModal } from "./components/modals/ExpenseModal";
import { SuccessPopup } from "@/components/shared/SuccessPopup";
import { WebView } from "react-native-webview";
import DocumentViewer from "@/components/shared/DocumentViewer";

export default function EmployeeExpenseScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [expenseToView, setExpenseToView] = useState<Expense | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [isAttachmentVisible, setIsAttachmentVisible] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: "", message: "" });

  useEffect(() => {
    if (!user?.uid) return;

    // Fetch real-time expenses
    const unsubscribe = subscribeToUserExpenses(user.uid, user.role, (data) => {
      setExpenses(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleOpenModalForNew = () => {
    setExpenseToEdit(null);
    setIsModalVisible(true);
  };

  const handleOpenModalForEdit = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setExpenseToEdit(null);
  };

  const openAttachment = (url: string) => {
    setIsAttachmentVisible(true);
  };

  const getStatusColor = (status: string) => {
    if (status === "reimbursed" || status === "verified" || status === "approved") return Colors.success;
    if (status === "rejected") return Colors.error;
    if (status === "draft") return Colors.text.tertiary;
    return Colors.warning; // all pending and intermediate stages
  };

  const getStatusDisplay = (status: string) => {
    if (status === "reimbursed" || status === "verified" || status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "draft") return "Draft";
    if (status === "draft") return "Draft";
    return "Pending";
  };

  const getCategoryBgColor = (category: string) => {
    switch (category) {
      case 'Travel': return '#EEF2FF'; 
      case 'Food':
      case 'Meals': return '#FFF7ED'; 
      case 'Fuel': return '#F0F9FF'; 
      case 'Supplies': return '#F3E8FF';
      case 'Other': return '#F1F5F9';
      default: return '#F3F4F6'; 
    }
  };

  const getCategoryIconColor = (category: string) => {
    switch (category) {
      case 'Travel': return '#6366F1'; 
      case 'Food':
      case 'Meals': return '#F97316'; 
      case 'Fuel': return '#0EA5E9'; 
      case 'Supplies': return '#9333EA';
      case 'Other': return '#475569';
      default: return '#6B7280'; 
    }
  };

  const renderCategoryIcon = (category: string, color: string) => {
    switch (category) {
      case 'Travel': return <Ionicons name="car" size={20} color={color} />;
      case 'Meals':
      case 'Food': return <Ionicons name="restaurant" size={20} color={color} />;
      case 'Fuel': return <MaterialCommunityIcons name="gas-station" size={20} color={color} />;
      case 'Supplies': return <Ionicons name="briefcase" size={20} color={color} />;
      case 'Other': return <Ionicons name="apps" size={20} color={color} />;
      default: return <Ionicons name="receipt" size={20} color={color} />;
    }
  };

  const renderItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => setExpenseToView(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryWrap}>
          <View style={[styles.iconRing, { backgroundColor: getCategoryBgColor(item.category) }]}>
            {renderCategoryIcon(item.category, getCategoryIconColor(item.category))}
          </View>
          <View style={{ flexShrink: 1, paddingRight: 8 }}>
            <Text style={styles.expenseCategory} numberOfLines={1}>{item.description || item.category}</Text>
            <Text style={styles.expenseDate}>{item.category} • {item.date}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
          <Text style={styles.expenseAmount}>₹{item.amount}</Text>
          <View
            style={[
              styles.statusBadgeSmall,
              { backgroundColor: getStatusColor(item.status) + "15" },
            ]}
          >
            <Text style={[styles.statusTextSmall, { color: getStatusColor(item.status) }]}>
              {getStatusDisplay(item.status).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    const totalPending = expenses
      .filter((e) => e.status !== "reimbursed" && e.status !== "rejected" && e.status !== "draft")
      .reduce((sum, e) => sum + e.amount, 0);
    const totalApproved = expenses
      .filter((e) => e.status === "reimbursed")
      .reduce((sum, e) => sum + e.amount, 0);

    return (
      <View style={styles.headerContent}>
        <View style={styles.summaryGrid}>
          <View
            style={[styles.summaryCard, { borderTopColor: Colors.warning }]}
          >
            <Text style={styles.summaryLabel}>Pending Claim</Text>
            <Text style={[styles.summaryAmount, { color: Colors.warning }]}>
              ₹{totalPending}
            </Text>
          </View>
          <View
            style={[styles.summaryCard, { borderTopColor: Colors.success }]}
          >
            <Text style={styles.summaryLabel}>Approved</Text>
            <Text style={[styles.summaryAmount, { color: Colors.success }]}>
              ₹{totalApproved}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.applyBtn}
          activeOpacity={0.8}
          onPress={handleOpenModalForNew}
        >
          <Ionicons
            name="add"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.applyBtnTxt}>Add Expense</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { marginTop: 24, marginBottom: 8 }]}>
          {categoriesList.map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
        </View>
      </View>
    );
  };

    const categoriesList = ["All", ...Array.from(new Set(expenses.map(e => e.category)))];
    const filteredExpenses = activeCategory === "All" ? expenses : expenses.filter(e => e.category === activeCategory);

    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expenses</Text>
          <View style={{ width: 32 }} />
        </View>
  
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredExpenses}
            keyExtractor={(item) => item.expenseId}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={Colors.text.tertiary}
              />
              <Text style={styles.emptyText}>No expenses found</Text>
            </View>
          }
        />
      )}

      <ExpenseModal
        isVisible={isModalVisible}
        onClose={handleCloseModal}
        expenseToEdit={expenseToEdit}
        onSuccess={(message, isEdit) => {
          setTimeout(() => {
            setSuccessPopup({
              visible: true,
              title: isEdit ? "Expense Updated" : "Expense Submitted",
              message
            });
          }, 400);
        }}
      />
      
      {/* Success Popup */}
      <SuccessPopup
        visible={successPopup.visible}
        title={successPopup.title}
        message={successPopup.message}
        onClose={() => setSuccessPopup(prev => ({ ...prev, visible: false }))}
      />
      {/* Details Modal */}
      <Modal visible={!!expenseToView} animationType="slide" transparent={true} onRequestClose={() => setExpenseToView(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setExpenseToView(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.previewModalContent}>
            <View style={styles.dragHandle} />
            
            {expenseToView && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* Status Pill */}
                <View style={styles.previewHeader}>
                  <View style={[styles.previewStatusPill, { backgroundColor: getStatusColor(expenseToView.status) + '15' }]}>
                    <Ionicons 
                      name={expenseToView.status === 'rejected' ? 'close-circle' : expenseToView.status === 'manager_approved' ? 'checkmark-circle' : 'time'} 
                      size={16} 
                      color={getStatusColor(expenseToView.status)} 
                    />
                    <Text style={[styles.previewStatusText, { color: getStatusColor(expenseToView.status) }]}>
                      {getStatusDisplay(expenseToView.status)}
                    </Text>
                  </View>
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.previewTitle}>{expenseToView.category}</Text>
                <Text style={styles.previewSubtitle}>Expense ID: #{expenseToView.expenseId?.substring(0,8).toUpperCase() || 'EXP-001'}</Text>

                {/* Grid */}
                <View style={styles.previewGrid}>
                  <View style={styles.previewGridCard}>
                    <View style={[styles.previewGridIcon, { backgroundColor: Colors.primary + '15' }]}>
                      <Ionicons name="cash-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.previewGridLabel}>Amount</Text>
                    <Text style={styles.previewGridValue}>₹{expenseToView.amount}</Text>
                  </View>
                  <View style={styles.previewGridCard}>
                    <View style={[styles.previewGridIcon, { backgroundColor: Colors.primary + '15' }]}>
                      <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.previewGridLabel}>Date</Text>
                    <Text style={[styles.previewGridValue, { fontSize: 12 }]}>
                      {expenseToView.date?.split('-').reverse().join('-')}
                    </Text>
                  </View>
                  <View style={styles.previewGridCard}>
                    <View style={[styles.previewGridIcon, { backgroundColor: Colors.primary + '15' }]}>
                      <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.previewGridLabel}>Category</Text>
                    <Text style={styles.previewGridValue}>{expenseToView.category}</Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.previewSectionTitle}>Description</Text>
                <Text style={styles.previewDescription}>{expenseToView.description}</Text>

                {/* Receipt */}
                {expenseToView.billUrls?.[0] && (
                  <>
                    <Text style={styles.previewSectionTitle}>Receipt</Text>
                    <TouchableOpacity style={styles.previewReceiptCard} onPress={() => openAttachment(expenseToView.billUrls![0])}>
                      <View style={styles.previewReceiptThumb}>
                        <Image 
                          source={
                            expenseToView.billUrls[0].toLowerCase().includes('.pdf') 
                              ? require('../../../../assets/document_icons/pdf.png') 
                              : require('../../../../assets/document_icons/image.png')
                          }
                          style={{ width: 28, height: 28, resizeMode: 'contain' }}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.previewReceiptName} numberOfLines={1}>
                          {expenseToView.billUrls[0].toLowerCase().includes('.pdf') ? 'document.pdf' : 'receipt.jpg'}
                        </Text>
                        <Text style={styles.previewReceiptSize}>View Document</Text>
                      </View>
                      <View style={styles.previewReceiptBtn}>
                        <Ionicons name="eye-outline" size={20} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {/* Rejection Reason */}
                {!!expenseToView.rejectionReason?.trim() && (
                  <View style={styles.previewRejectionCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                      <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
                      <Text style={styles.previewRejectionTitle}>Reason for Rejection</Text>
                    </View>
                    <Text style={styles.previewRejectionText}>{expenseToView.rejectionReason}</Text>
                    
                    <TouchableOpacity 
                      style={{ marginTop: 16, backgroundColor: Colors.error, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onPress={() => {
                        const expense = expenseToView;
                        setExpenseToView(null);
                        setTimeout(() => handleOpenModalForEdit(expense), 300);
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Edit and Resubmit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Attachment Image/PDF Viewer Modal */}
      <DocumentViewer
        visible={isAttachmentVisible}
        url={expenseToView?.billUrls?.[0]}
        title="Attached Bill"
        onClose={() => setIsAttachmentVisible(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnPrimary: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  listContainer: { padding: 12, paddingBottom: 100 },
  headerContent: { marginBottom: 12 },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },

  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 4,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryAmount: { fontSize: 22, fontWeight: "bold" },

  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    elevation: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  applyBtnTxt: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },

  card: {
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryWrap: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  expenseDate: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  expenseAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text.primary,
  },

  descriptionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },

  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.background,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: Spacing.md,
  },
  attachmentText: { fontSize: 11, color: Colors.text.secondary },

  rejectionBox: {
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectionText: { fontSize: 12, color: Colors.error, flex: 1 },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  resubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  resubmitBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  modalScroll: { marginBottom: Spacing.lg },
  detailLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginBottom: 2 },
  detailValue: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text.primary, marginBottom: Spacing.md },
  viewBillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#BFDBFE', justifyContent: 'center' },
  viewBillText: { color: Colors.primary, fontWeight: '600' },
  
  // New Preview Modal Styles
  previewModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  filterScroll: { gap: 8, paddingBottom: 8, paddingHorizontal: 4 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#334155' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFF' },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6
  },
  statusTextSmall: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative'
  },
  previewStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6
  },
  previewStatusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4
  },
  previewSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  previewGridCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  previewGridIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  previewGridLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4
  },
  previewGridValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center'
  },
  previewSectionTitle: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 8
  },
  previewDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16
  },
  previewReceiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24
  },
  previewReceiptThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  previewReceiptName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4
  },
  previewReceiptSize: {
    fontSize: 12,
    color: '#64748B'
  },
  previewReceiptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm
  },
  previewRejectionCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24
  },
  previewRejectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error
  },
  previewRejectionText: {
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 20
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: '100%', height: '80%' },
});
