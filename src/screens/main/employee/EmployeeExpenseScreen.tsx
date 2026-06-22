import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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

  useEffect(() => {
    if (!user?.uid) return;

    // Fetch real-time expenses
    const unsubscribe = subscribeToUserExpenses(user.uid, (data) => {
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
    <View style={styles.card}>
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
    </View>
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
          style={styles.headerBtn}
          onPress={handleOpenModalForNew}
        >
          <Ionicons name="add" size={20} color={Colors.text.primary} />
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
});
