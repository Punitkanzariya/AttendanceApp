import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";

interface LeaveBalanceBoxesProps {
  userLeaveBalance: any;
  isLoading?: boolean;
  leaves?: any[];
  leaveTypes?: any[];
  user?: any;
}

export default function LeaveBalanceBoxes({
  userLeaveBalance,
  isLoading,
  leaves = [],
  leaveTypes = [],
  user,
}: LeaveBalanceBoxesProps) {
  const LEAVE_COLORS = ["#2E7D32", "#2563EB", "#F59E0B"];

  const leaveCategories = [
    { key: "sick", label: "Sick Leave", color: LEAVE_COLORS[0] },
    { key: "casual", label: "Casual Leave", color: LEAVE_COLORS[1] },
    { key: "earned", label: "Earned Leave", color: LEAVE_COLORS[2] },
  ];

  const currentYear = new Date().getFullYear();

  // Calculate totals
  let totalMax = 0;
  let totalTaken = 0;

  leaveCategories.forEach((category) => {
    const leaveType = leaveTypes.find((lt) =>
      lt.name.toLowerCase().includes(category.key),
    );
    const max =
      userLeaveBalance?.[category.key] !== undefined
        ? userLeaveBalance[category.key]
        : user?.leaveBalances?.[leaveType?.leaveTypeId || category.key] !==
            undefined
          ? user.leaveBalances[leaveType?.leaveTypeId || category.key]
          : leaveType?.annualQuota || 0;

    const taken = userLeaveBalance?.[`${category.key}Taken`] || 0;

    totalMax += max;
    totalTaken += taken;
  });

  const categoriesWithTotal = [
    ...leaveCategories,
    { key: "total", label: "Total Leaves", color: "#6366F1" }, // Indigo color for total
  ];

  return (
    <View style={styles.leaveGrid}>
      {categoriesWithTotal
        .reduce(
          (resultArray, item, index) => {
            const chunkIndex = Math.floor(index / 2);
            if (!resultArray[chunkIndex]) {
              resultArray[chunkIndex] = [];
            }
            resultArray[chunkIndex].push(item);
            return resultArray;
          },
          [] as (typeof categoriesWithTotal)[],
        )
        .map((row, rowIndex) => (
          <View key={rowIndex} style={styles.leaveRow}>
            {row.map((category) => {
              let max, taken, balance;

              if (category.key === "total") {
                max = totalMax;
                taken = totalTaken;
                balance = Math.max(0, max - taken);
              } else {
                const leaveType = leaveTypes.find((lt) =>
                  lt.name.toLowerCase().includes(category.key),
                );

                // Try to get max from userLeaveBalance, then user.leaveBalances, then leaveType annualQuota, then 0
                max =
                  userLeaveBalance?.[category.key] !== undefined
                    ? userLeaveBalance[category.key]
                    : user?.leaveBalances?.[
                          leaveType?.leaveTypeId || category.key
                        ] !== undefined
                      ? user.leaveBalances[
                          leaveType?.leaveTypeId || category.key
                        ]
                      : leaveType?.annualQuota || 0;

                taken = userLeaveBalance?.[`${category.key}Taken`] || 0;
                balance = Math.max(0, max - taken);
              }

              return (
                <View key={category.key} style={styles.leaveCard}>
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.leaveIconRing,
                        { borderColor: category.color },
                      ]}
                    >
                      <Ionicons
                        name="briefcase-outline"
                        size={14}
                        color={Colors.text.primary}
                      />
                    </View>
                    <Text style={styles.leaveLabelBold}>{category.label}</Text>
                  </View>

                  <View style={styles.balanceContainer}>
                    <Text style={styles.leaveNum}>
                      {isLoading ? "-" : balance}
                    </Text>
                    <Text style={styles.leaveTotalTxt}> Remaining</Text>
                  </View>

                  <Text style={styles.leaveTakenTxt}>
                    {isLoading ? "-" : taken} Taken • {isLoading ? "-" : max}{" "}
                    Total
                  </Text>
                </View>
              );
            })}
            {row.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  leaveGrid: { flexDirection: "column", gap: 10, marginBottom: 16 },
  leaveRow: { flexDirection: "row", gap: 10 },
  leaveCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  leaveIconRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveLabelBold: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2,
  },
  leaveNum: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text.primary,
  },
  leaveTotalTxt: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: "600",
    marginLeft: 4,
  },
  leaveTakenTxt: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
});
