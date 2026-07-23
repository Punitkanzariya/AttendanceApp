import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@/store/authStore";
import { Colors, Spacing, BorderRadius } from "@/theme";
import { formatDisplayStatus } from "@/utils/statusUtils";
import { formatLeaveDurationText, formatDateDDMMYYYY } from "@/utils/dateUtils";
import {
  subscribeToUserLeaves,
  subscribeToUserLeaveBalance,
} from "@/firebase/leaveService";
import { LEAVE_TYPE_LABELS } from "@/utils/constants";
import type { LeaveRequest, LeaveType } from "@/types";
import { LeaveModal } from "./components/modals/LeaveModal";
import LeaveBalanceBoxes from "@/components/shared/LeaveBalanceBoxes";
import { SuccessPopup } from "@/components/shared/SuccessPopup";

export default function EmployeeLeaveScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [userLeaveBalance, setUserLeaveBalance] = useState<any>(null);
  const [successPopup, setSuccessPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeLeaves = subscribeToUserLeaves(
      user.uid,
      user.role,
      (data) => {
        setLeaves(data);
        setIsLoading(false);
      },
    );

    const currentYear = new Date().getFullYear();
    const unsubscribeBalance = subscribeToUserLeaveBalance(
      user.uid,
      currentYear,
      (data: any) => {
        setUserLeaveBalance(data);
      },
    );

    const timeout = setTimeout(() => setIsLoading(false), 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribeLeaves();
      unsubscribeBalance();
    };
  }, [user?.uid]);

  const getLeaveIconInfo = (type: string) => {
    switch (type) {
      case "sick":
        return { icon: "medkit-outline", color: "#EF4444", bg: "#FEE2E2" };
      case "casual":
        return { icon: "umbrella-outline", color: "#3B82F6", bg: "#DBEAFE" };
      case "earned":
        return { icon: "briefcase-outline", color: "#8B5CF6", bg: "#EDE9FE" };
      default:
        return { icon: "calendar-outline", color: "#6B7280", bg: "#F3F4F6" };
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => {
    console.log("item", item);
    const iconInfo = getLeaveIconInfo(item.type);
    const isApproved = item.status === "approved";

    return (
      <TouchableOpacity
        style={styles.historyCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedLeave(item);
          setDetailModalVisible(true);
        }}
      >
        <View
          style={[styles.historyIconWrap, { backgroundColor: iconInfo.bg }]}
        >
          <Ionicons
            name={iconInfo.icon as any}
            size={24}
            color={iconInfo.color}
          />
        </View>
        <View style={styles.historyDetails}>
          <Text style={styles.historyTitle}>
            {item.type
              ? LEAVE_TYPE_LABELS[item.type] || item.type
              : "Leave Request"}
          </Text>
          <Text style={styles.historySubtitle}>
            {formatLeaveDurationText(
              item.startDate,
              item.endDate,
              item.totalDays,
              item.durationType,
              item.halfDayPeriod,
            )}
          </Text>
        </View>
        <View
          style={[
            styles.historyBadge,
            isApproved
              ? { backgroundColor: "#F3F4F6" }
              : { backgroundColor: "#FEE2E2" },
          ]}
        >
          <Text
            style={[
              styles.historyBadgeTxt,
              isApproved ? { color: "#374151" } : { color: "#DC2626" },
            ]}
          >
            {item.status.includes("pending")
              ? "Pending"
              : formatDisplayStatus(item.status)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.headerContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Leave Balance</Text>
        </View>

        <LeaveBalanceBoxes
          userLeaveBalance={userLeaveBalance}
          isLoading={isLoading}
          leaves={leaves}
          user={user}
        />

        <TouchableOpacity
          style={styles.applyBtn}
          activeOpacity={0.8}
          onPress={() => setIsModalVisible(true)}
        >
          <Ionicons
            name="add"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.applyBtnTxt}>Apply for Leave</Text>
        </TouchableOpacity>

        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>History</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllTxt}>View All</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Leaves</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.requestId}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={Colors.text.tertiary}
              />
              <Text style={styles.emptyText}>No leave history found</Text>
            </View>
          }
        />
      )}

      {/* Apply Leave Modal */}
      <LeaveModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        userLeaveBalance={userLeaveBalance}
        existingLeaves={leaves}
        onSuccess={(message) => {
          setTimeout(() => {
            setSuccessPopup({
              visible: true,
              title: "Leave Applied",
              message,
            });
          }, 400);
        }}
      />

      {/* Leave Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Leave Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            {selectedLeave && (
              <View style={{ paddingBottom: 10 }}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {selectedLeave.type
                      ? LEAVE_TYPE_LABELS[selectedLeave.type] ||
                        selectedLeave.type
                      : "Leave Request"}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {formatLeaveDurationText(
                      selectedLeave.startDate,
                      selectedLeave.endDate,
                      selectedLeave.totalDays,
                      selectedLeave.durationType,
                      selectedLeave.halfDayPeriod,
                    )}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color:
                          selectedLeave.status === "approved"
                            ? Colors.success
                            : Colors.warning,
                      },
                    ]}
                  >
                    {selectedLeave.status.includes("pending")
                      ? "Pending"
                      : formatDisplayStatus(selectedLeave.status)}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.detailValue}>{selectedLeave.reason}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Applied On</Text>
                  <Text style={styles.detailValue}>
                    {selectedLeave.actionLogs?.[0]?.timestamp
                      ? formatDateDDMMYYYY(
                          selectedLeave.actionLogs[0].timestamp,
                        )
                      : "N/A"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Success Popup */}
      <SuccessPopup
        visible={successPopup.visible}
        title={successPopup.title}
        message={successPopup.message}
        onClose={() => setSuccessPopup((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContainer: { padding: 12, paddingBottom: 100 },
  headerContent: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  applyBtnTxt: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  viewAllTxt: {
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "700",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyDetails: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  historySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  historyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  historyBadgeTxt: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  detailModalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 16,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "500",
    lineHeight: 22,
  },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
});
