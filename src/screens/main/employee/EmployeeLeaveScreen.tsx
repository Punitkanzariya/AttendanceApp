import React, { useEffect, useState } from "react";
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
import { useAuthStore } from "@/store/authStore";
import {
  Colors,
  Spacing,
  BorderRadius,
} from "@/theme";
import { formatDisplayStatus } from "@/utils/statusUtils";
import { formatLeaveDurationText, formatDateDDMMYYYY } from '@/utils/dateUtils';
import { subscribeToUserLeaves, subscribeToLeaveTypes, subscribeToUserLeaveBalance } from "@/firebase/leaveService";
import type { LeaveRequest, LeaveType } from "@/types";
import { LeaveModal } from "./components/modals/LeaveModal";
import LeaveBalanceBoxes from "@/components/shared/LeaveBalanceBoxes";

export default function EmployeeLeaveScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [userLeaveBalance, setUserLeaveBalance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeLeaves = subscribeToUserLeaves(user.uid, user.role, (data) => {
      setLeaves(data);
      setIsLoading(false);
    });

    const unsubscribeTypes = subscribeToLeaveTypes((data) => {
      setLeaveTypes(data);
    });

    const currentYear = new Date().getFullYear();
    const unsubscribeBalance = subscribeToUserLeaveBalance(user.uid, currentYear, (data: any) => {
      setUserLeaveBalance(data);
    });

    const timeout = setTimeout(() => setIsLoading(false), 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribeLeaves();
      unsubscribeTypes();
      unsubscribeBalance();
    };
  }, [user?.uid]);



  const getStatusColor = (status: string) => {
    if (status.includes('pending')) return Colors.warning;
    if (status === 'approved' || status === 'reimbursed' || status === 'verified') return Colors.success;
    if (status === 'rejected') return Colors.error;
    return Colors.text.tertiary;
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leaveTypeText}>
            {leaveTypes.find(t => t.leaveTypeId === item.type)?.name || item.type}
          </Text>
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Colors.text.secondary}
            />
            <Text style={styles.dateText}>
              {formatLeaveDurationText(item.startDate, item.endDate, item.totalDays, item.durationType, item.halfDayPeriod)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.includes('pending') ? 'Pending' : formatDisplayStatus(item.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.reasonLabel}>Reason</Text>
      <Text style={styles.reasonText}>{item.reason}</Text>



      <View style={styles.cardFooter}>
        <Text style={styles.appliedDate}>
          Applied on {item.actionLogs?.[0]?.timestamp ? formatDateDDMMYYYY(item.actionLogs[0].timestamp) : "N/A"}
        </Text>
      </View>
    </View>
  );

  const renderHeader = () => {
    const currentYear = new Date().getFullYear();

    const calculateTaken = (typeId: string) => {
      return leaves
        .filter((l) => l.type === typeId && l.status === 'approved')
        .filter((l) => {
          if (!l.startDate) return false;
          let dateYear = currentYear;
          try {
            if (l.startDate.includes('-')) {
               const parts = l.startDate.split('-');
               if (parts[0].length === 4) {
                 dateYear = parseInt(parts[0], 10);
               } else if (parts[2]?.length === 4) {
                 dateYear = parseInt(parts[2], 10);
               } else {
                 dateYear = new Date(l.startDate).getFullYear();
               }
            } else {
               dateYear = new Date(l.startDate).getFullYear();
            }
          } catch (e) {}
          return dateYear === currentYear;
        })
        .reduce((total, l) => total + (Number(l.totalDays) || 1), 0);
    };

    let totalTakenAll = 0;
    let totalMaxAll = 0;

    return (
    <View style={styles.headerContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leave Balance</Text>
      </View>

      <LeaveBalanceBoxes userLeaveBalance={userLeaveBalance} isLoading={isLoading} leaves={leaves} leaveTypes={leaveTypes} user={user} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leave History</Text>
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
        <TouchableOpacity
          style={styles.headerBtnPrimary}
          onPress={() => setIsModalVisible(true)}
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
  card: {
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerContent: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  monthBtnTxt: { color: "#2563EB", fontSize: 11, fontWeight: "600" },
  leaveGrid: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  leaveRow: { flexDirection: "row", gap: Spacing.sm },
  leaveBalanceCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaveIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 2,
  },
  leaveTotalTxt: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: "500",
  },
  leaveLabel: { fontSize: 10, color: Colors.text.secondary },
  leaveTakenTxt: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  leaveTypeText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13, fontWeight: "500", color: Colors.text.secondary },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.text.primary,
    marginTop: 4,
    lineHeight: 22,
  },
  notesContainer: {
    marginTop: Spacing.md,
    flexDirection: "row",
    gap: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  notesText: { fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
  cardFooter: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  appliedDate: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.text.tertiary,
    textAlign: "right",
  },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl * 2 },
  emptyText: { marginTop: Spacing.md, color: Colors.text.tertiary },
});
