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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from "@/theme";
import { formatDisplayStatus } from "@/utils/statusUtils";
import { useAuthStore } from "@/store/authStore";
import { subscribeToUserExpenses } from "@/firebase/expenseService";
import type { Expense } from "@/types";
import { ExpenseModal } from "./components/modals/ExpenseModal";
import { SuccessPopup } from "@/components/shared/SuccessPopup";
import { WebView } from "react-native-webview";

export default function EmployeeExpenseScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(
    null,
  );
  const [expenseToView, setExpenseToView] = useState<Expense | null>(null);
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
    return "Pending";
  };

  const renderItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => setExpenseToView(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryWrap}>
          <View style={styles.iconRing}>
            <Ionicons
              name={
                item.category === "Travel"
                  ? "car-outline"
                  : item.category === "Meals"
                    ? "restaurant-outline"
                    : item.category === "Fuel"
                      ? "speedometer-outline"
                      : item.category === "Supplies"
                        ? "briefcase-outline"
                        : "cart-outline"
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

      {item.billUrls?.[0] && (
        <View style={styles.attachmentBadge}>
          <Ionicons
            name="document-attach-outline"
            size={14}
            color={Colors.text.secondary}
          />
          <Text style={styles.attachmentText}>Receipt Attached</Text>
        </View>
      )}

      {item.status === "rejected" && item.rejectionReason && (
        <View style={styles.rejectionBox}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: getStatusColor(item.status) + "15",
              borderColor: getStatusColor(item.status) + "40",
            },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusDisplay(item.status)}
          </Text>
        </View>

        {item.status === "rejected" && (
          <TouchableOpacity
            style={styles.resubmitBtn}
            onPress={() => handleOpenModalForEdit(item)}
          >
            <Ionicons name="pencil" size={14} color={Colors.primary} />
            <Text style={styles.resubmitBtnText}>Edit & Resubmit</Text>
          </TouchableOpacity>
        )}
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
        </View>
      </View>
    );
  };

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
        <TouchableOpacity
          style={styles.headerBtnPrimary}
          onPress={handleOpenModalForNew}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
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
      <Modal visible={!!expenseToView} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Expense Details</Text>
              <TouchableOpacity onPress={() => setExpenseToView(null)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {expenseToView && (
              <View style={styles.modalScroll}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                  <View>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(expenseToView.status) + '20', alignSelf: 'flex-start', marginTop: 2, borderWidth: 0 }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(expenseToView.status), fontSize: 11 }]}>
                        {getStatusDisplay(expenseToView.status).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
                  <View>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={[styles.detailValue, { fontSize: FontSize.lg, color: Colors.primary }]}>₹{expenseToView.amount}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{expenseToView.date}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailLabel}>Category:</Text>
                    <Text style={styles.detailValue}>{expenseToView.category}</Text>
                  </View>
                </View>

                <Text style={styles.detailLabel}>Description:</Text>
                <Text style={styles.detailValue}>{expenseToView.description}</Text>

                {expenseToView.billUrls?.[0] && (
                  <TouchableOpacity style={styles.viewBillBtn} onPress={() => openAttachment(expenseToView.billUrls![0])}>
                    <Ionicons name="open-outline" size={16} color={Colors.primary} />
                    <Text style={styles.viewBillText}>View Attached Bill</Text>
                  </TouchableOpacity>
                )}

                {!!expenseToView.rejectionReason?.trim() && (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={styles.detailLabel}>Rejection Reason / Notes:</Text>
                    <Text style={[styles.detailValue, { color: Colors.error }]}>{expenseToView.rejectionReason}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Attachment Image/PDF Viewer Modal */}
      <Modal visible={isAttachmentVisible} transparent={true} animationType="fade">
        <View style={styles.imageViewerOverlay}>
          {expenseToView?.billUrls?.[0] && (
            expenseToView.billUrls[0].toLowerCase().includes('.pdf') ? (
               <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#fff', marginTop: Platform.OS === 'ios' ? 40 : 0 }}>
                  <TouchableOpacity 
                    style={{ position: 'absolute', top: 10, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20 }} 
                    onPress={() => setIsAttachmentVisible(false)}
                  >
                    <Ionicons name="close-circle" size={36} color="#ffffff" />
                  </TouchableOpacity>
                  {Platform.OS === 'web' ? (
                    <iframe src={expenseToView.billUrls[0]} style={{ width: '100%', height: '100%', border: 'none' }} />
                  ) : (
                    <WebView 
                      source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(expenseToView.billUrls[0])}` }}
                      style={{ flex: 1 }}
                    />
                  )}
               </View>
            ) : (
              <View style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <TouchableOpacity 
                  style={{ position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20, zIndex: 10 }} 
                  onPress={() => setIsAttachmentVisible(false)}
                >
                  <Ionicons name="close-circle" size={36} color="#ffffff" />
                </TouchableOpacity>
                <Image 
                  source={{ uri: expenseToView.billUrls[0] }} 
                  style={styles.fullImage} 
                  resizeMode="contain" 
                />
              </View>
            )
          )}
        </View>
      </Modal>

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
  categoryWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 8,
    marginBottom: Spacing.md,
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
  viewBillText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: '100%', height: '80%' },
});
