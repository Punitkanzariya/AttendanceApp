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
import { Colors, FontSize, Spacing, BorderRadius } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { subscribeToUserExpenses } from "@/firebase/expenseService";
import type { ExpenseRequest, ExpenseStatus } from "@/types";
import { ExpenseModal } from "./components/modals/ExpenseModal";

export default function EmployeeExpenseScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseRequest | null>(
    null,
  );
  const [expenseToView, setExpenseToView] = useState<ExpenseRequest | null>(null);
  const [isAttachmentVisible, setIsAttachmentVisible] = useState(false);

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

  const handleOpenModalForEdit = (expense: ExpenseRequest) => {
    setExpenseToEdit(expense);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setExpenseToEdit(null);
  };

  const openAttachment = (url: string) => {
    if (url.startsWith('data:image')) {
      setIsAttachmentVisible(true);
    } else if (Platform.OS === 'web') {
      // For PDFs on web
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

  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case "reimbursed":
        return Colors.success;
      case "rejected":
        return Colors.error;
      default:
        return Colors.warning;
    }
  };

  const renderItem = ({ item }: { item: ExpenseRequest }) => (
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

      {item.attachmentUrl && (
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
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status.replace("_", " ").toUpperCase()}
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
      .filter((e) => e.status.startsWith("pending"))
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
          keyExtractor={(item) => item.id}
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
                        {expenseToView.status.replace('_', ' ').toUpperCase()}
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

                {expenseToView.attachmentUrl && (
                  <TouchableOpacity style={styles.viewBillBtn} onPress={() => openAttachment(expenseToView.attachmentUrl!)}>
                    <Ionicons name="open-outline" size={16} color={Colors.primary} />
                    <Text style={styles.viewBillText}>View Attached Bill</Text>
                  </TouchableOpacity>
                )}

                {expenseToView.rejectionReason && (
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

      {/* Attachment Image Viewer Modal */}
      <Modal visible={isAttachmentVisible} transparent={true} animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setIsAttachmentVisible(false)}>
            <Ionicons name="close-circle" size={36} color={Colors.white} />
          </TouchableOpacity>
          {expenseToView?.attachmentUrl && (
            <Image 
              source={{ uri: expenseToView.attachmentUrl }} 
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
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
});
