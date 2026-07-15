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
import { Modal } from 'react-native';
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
import type { AttendanceRecord, LeaveRequest } from "@/types";
import AttendanceDetailModal from "@/components/shared/AttendanceDetailModal";
import MonthPickerModal from "@/components/shared/MonthPickerModal";
import { subscribeToUserLeaves } from "@/firebase/leaveService";

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
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubToday = subscribeToTodayAttendance(user.uid, user.role, (record) => {
      setTodayRecord(record);
      setLoadingRecord(false);
    });

    const unsubHistory = subscribeToUserAttendanceHistory(
      user.uid,
      (records: AttendanceRecord[]) => {
        const todayStr = getLocalDateString();
        const filtered = records.filter((r) => r.dateStr !== todayStr);
        setHistory(filtered);
      },
    );

    const unsubLeaves = subscribeToUserLeaves(user.uid, user.role, (data) => {
      setLeaves(data.filter(l => l.status === 'approved'));
    });

    return () => {
      unsubToday();
      unsubHistory();
      unsubLeaves();
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

  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Build a Set of all dates covered by approved leaves
  const leaveDateSet = React.useMemo(() => {
    const set = new Set<string>();
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [leaves]);

  const getDayStatus = (year: number, month: number, day: number) => {
    const dateObj = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateObj > today) return 'future';

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = filteredRecords.find(r => r.dateStr === dateStr);

    if (record) return 'present';
    if (leaveDateSet.has(dateStr)) return 'leave';
    if (dateObj.getDay() === 0) return 'weekend'; // Sunday

    return 'absent';
  };

  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    days.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === days.length - 1) {
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return (
      <View style={styles.calendarContainer}>
        {/* Weekday Header */}
        <View style={styles.calendarHeader}>
          {WEEKDAYS.map((wd, i) => (
            <Text key={i} style={styles.calendarHeaderText}>{wd}</Text>
          ))}
        </View>
        
        {/* Weeks */}
        {weeks.map((week, wIdx) => (
          <View key={wIdx} style={styles.calendarRow}>
            {week.map((day, dIdx) => {
              if (!day) return <View key={dIdx} style={styles.calendarCell} />;
              
              const status = getDayStatus(year, month, day);
              let bgColor = 'transparent';
              let textColor = '#0F172A';
              
              if (status === 'present') {
                bgColor = '#DCFCE7';
                textColor = '#166534';
              } else if (status === 'leave') {
                bgColor = '#EDE9FE'; // light purple
                textColor = '#6D28D9';
              } else if (status === 'absent') {
                bgColor = '#FEE2E2';
                textColor = '#991B1B';
              } else if (status === 'weekend') {
                textColor = '#94A3B8';
              } else if (status === 'future') {
                textColor = '#CBD5E1';
              }

              return (
                <View key={dIdx} style={styles.calendarCell}>
                  <View style={[styles.dayCircle, { backgroundColor: bgColor }]}>
                    <Text style={[styles.dayText, { color: textColor }]}>{day}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        
        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#166534' }]} />
            <Text style={styles.legendText}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6D28D9' }]} />
            <Text style={styles.legendText}>Leave</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#991B1B' }]} />
            <Text style={styles.legendText}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
            <Text style={styles.legendText}>Holiday/Off</Text>
          </View>
        </View>
      </View>
    );
  };

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
              <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Calendar View */}
          {renderCalendar()}

          {/* List */}
          {loadingRecord ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (() => {
            // Build leave day cards for the selected month
            const leaveDayCards: Array<{ dateStr: string; leave: LeaveRequest }> = [];
            leaves.forEach(leave => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const cur = new Date(start);
              while (cur <= end) {
                const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
                if (
                  cur.getMonth() === selectedDate.getMonth() &&
                  cur.getFullYear() === selectedDate.getFullYear()
                ) {
                  // Only add if no attendance record exists for this day
                  const hasAttendance = filteredRecords.some(r => r.dateStr === key);
                  if (!hasAttendance) {
                    leaveDayCards.push({ dateStr: key, leave });
                  }
                }
                cur.setDate(cur.getDate() + 1);
              }
            });

            const allCards = [
              ...filteredRecords.map(r => ({ type: 'attendance' as const, dateStr: r.dateStr, record: r })),
              ...leaveDayCards.map(l => ({ type: 'leave' as const, dateStr: l.dateStr, leave: l.leave })),
            ].sort((a, b) => b.dateStr.localeCompare(a.dateStr));

            if (allCards.length === 0) {
              return (
                <Text style={{ textAlign: 'center', marginTop: 40, color: Colors.text.secondary }}>
                  No records found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                </Text>
              );
            }

            return allCards.map((item, index) => {
              const dateObj = new Date(item.dateStr);
              const day = String(dateObj.getDate()).padStart(2, '0');
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const year = dateObj.getFullYear();
              const dayStr = `${day}-${month}-${year}`;

              if (item.type === 'leave') {
                return (
                  <View key={`leave_${item.dateStr}_${index}`} style={[styles.card, styles.leaveCard]}>
                    <View style={styles.cardInner}>
                      {/* Top Row */}
                      <View style={styles.cardTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.cardIndicator, { backgroundColor: '#6D28D9' }]} />
                          <Text style={styles.dateText}>{dayStr}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: '#EDE9FE' }]}>
                          <Text style={[styles.badgeText, { color: '#6D28D9' }]}>ON LEAVE</Text>
                        </View>
                      </View>

                      {/* Leave Info */}
                      <View style={styles.leaveInfoRow}>
                        <View style={[styles.leaveIconBg]}>
                          <Ionicons name="calendar" size={20} color="#6D28D9" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.leaveTypeText}>{item.leave.type}</Text>
                          <Text style={styles.leaveReasonText} numberOfLines={1}>
                            {item.leave.reason}
                          </Text>
                        </View>
                        <View style={styles.leaveDurationBadge}>
                          <Text style={styles.leaveDurationText}>{item.leave.totalDays} Day{item.leave.totalDays > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }

              const record = item.record;
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
                    <View style={styles.cardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.cardIndicator} />
                        <Text style={styles.dateText}>{dayStr}</Text>
                      </View>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>GENERAL</Text>
                        </View>
                        <Ionicons name="business" size={16} color={Colors.text.tertiary} style={{ marginLeft: 6 }} />
                      </View>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: Colors.success }]}>
                          {formatTime(record.checkIn?.timestamp)}
                        </Text>
                        <Text style={styles.statLabel}>Check In</Text>
                      </View>

                      <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: Colors.error }]}>
                          {record.checkOut ? formatTime(record.checkOut.timestamp) : '--:--'}
                        </Text>
                        <Text style={styles.statLabel}>Check Out</Text>
                      </View>

                      <View style={[styles.statCol, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.statValue, { color: record.checkOut ? hrsColor : Colors.text.primary }]}>
                          {getWorkingHours(record)}
                        </Text>
                        <Text style={styles.statLabel}>Working HR's</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            });
          })()}

        </ScrollView>

        {/* Custom Month/Year Picker Modal */}
        <MonthPickerModal
          visible={isMonthPickerVisible}
          selectedDate={selectedDate}
          onClose={() => setMonthPickerVisible(false)}
          onSelect={(date) => {
            setSelectedDate(date);
            setMonthPickerVisible(false);
          }}
        />

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
    borderWidth: 1,
    borderColor: Colors.border,
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
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaveCard: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAFAFE',
  },
  leaveInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    padding: 10,
  },
  leaveIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D8B4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C1D95',
  },
  leaveReasonText: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  leaveDurationBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaveDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarCell: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
