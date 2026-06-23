import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@/store/authStore";
import { Colors, Spacing, BorderRadius, Shadow } from "@/theme";
import {
  subscribeToTodayAttendance,
  subscribeToUserAttendanceHistory,
  getLocalDateString,
} from "@/firebase";
import type { AttendanceRecord } from "@/types";
import AttendanceDetailModal from "@/components/shared/AttendanceDetailModal";

export default function EmployeeAttendanceScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isMonthPickerVisible, setMonthPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubToday = subscribeToTodayAttendance(user.uid, (record) => {
      setTodayRecord(record);
      setLoadingRecord(false);
    });

    const unsubHistory = subscribeToUserAttendanceHistory(
      user.uid,
      (records) => {
        const todayStr = getLocalDateString();
        const filtered = records.filter((r) => r.dateStr !== todayStr);
        setHistory(filtered);
      },
    );

    return () => {
      unsubToday();
      unsubHistory();
    };
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const formatTime = (isoString?: string) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkingHours = (record: AttendanceRecord) => {
    if (record.checkOut) {
      const hrsNum = Number(record.workingHours || 0);
      if (!isNaN(hrsNum)) {
         const h = Math.floor(hrsNum);
         const m = Math.floor((hrsNum - h) * 60);
         return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
      }
      return `${record.workingHours} Hrs`;
    }
    return "In Progress";
  };

  // Combine records to display
  const combinedRecords = [...(todayRecord ? [todayRecord] : []), ...history];

  const filteredRecords = combinedRecords.filter(r => {
    const d = new Date(r.dateStr);
    return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.root}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance Details</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Monthly Control */}
          <View style={styles.monthHeaderRow}>
            <Text style={styles.monthLabel}>Attendance Monthly</Text>
            <TouchableOpacity style={styles.monthPicker} onPress={() => setMonthPickerVisible(true)}>
              <Text style={styles.monthPickerText}>{selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}</Text>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* List */}
          {loadingRecord ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : filteredRecords.length === 0 ? (
            <Text
              style={{
                textAlign: "center",
                marginTop: 40,
                color: Colors.text.secondary,
              }}
            >
              No attendance records found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
            </Text>
          ) : (
            filteredRecords.map((record, index) => {
              const dateObj = new Date(record.dateStr);
              const dayStr = dateObj.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              const hrs = Number(record.workingHours || 0);
              const hrsColor = hrs >= 8 ? Colors.success : Colors.warning;

              return (
                <TouchableOpacity
                  key={record.id || index}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRecord(record);
                    setDetailVisible(true);
                  }}
                >
                  <View style={styles.cardInner}>
                    {/* Top Row: Date & Badge */}
                    <View style={styles.cardTopRow}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View style={styles.cardIndicator} />
                        <Text style={styles.dateText}>{dayStr}</Text>
                      </View>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>GENERAL</Text>
                        </View>
                        <Ionicons
                          name="business"
                          size={16}
                          color={Colors.text.tertiary}
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                    </View>

                    {/* Columns */}
                    <View style={styles.statsRow}>
                      <View style={styles.statCol}>
                        <Text
                          style={[styles.statValue, { color: Colors.success }]}
                        >
                          {formatTime(record.checkIn?.timestamp)}
                        </Text>
                        <Text style={styles.statLabel}>Check In</Text>
                      </View>

                      <View style={styles.statCol}>
                        <Text
                          style={[styles.statValue, { color: Colors.error }]}
                        >
                          {record.checkOut
                            ? formatTime(record.checkOut.timestamp)
                            : "--:--"}
                        </Text>
                        <Text style={styles.statLabel}>Check Out</Text>
                      </View>

                      <View
                        style={[styles.statCol, { alignItems: "flex-end" }]}
                      >
                        <Text
                          style={[
                            styles.statValue,
                            {
                              color: record.checkOut
                                ? hrsColor
                                : Colors.text.primary,
                            },
                          ]}
                        >
                          {getWorkingHours(record)}
                        </Text>
                        <Text style={styles.statLabel}>Working HR's</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Native Date Picker */}
        {isMonthPickerVisible && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setMonthPickerVisible(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}

        <AttendanceDetailModal
          visible={isDetailVisible}
          onClose={() => setDetailVisible(false)}
          record={selectedRecord}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.employeeBg },
  root: { flex: 1, position: "relative" },
  container: { padding: 16, paddingBottom: Spacing.xxl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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

  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  monthPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EBF4FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  monthPickerText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIndicator: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  cardInner: {
    flex: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.success,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statCol: {
    flex: 1,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    fontWeight: "600",
  },
});
