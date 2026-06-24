import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProjectManagementTabParamList, AttendanceRecord, LeaveRequest, ExpenseRequest } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import { subscribeToAllAttendance } from '@/firebase/attendanceService';
import { subscribeToLeavesForRole } from '@/firebase/leaveService';
import { subscribeToExpensesForRole } from '@/firebase/expenseService';
import { getLocalDateString } from '@/firebase/attendanceService';

export default function ProjectDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<BottomTabNavigationProp<ProjectManagementTabParamList>>();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);

  // Subscriptions
  useEffect(() => {
    // 1. Subscribe to Attendance
    const unsubAttendance = subscribeToAllAttendance((data: AttendanceRecord[]) => {
      setAttendance(data);
    });

    // 2. Subscribe to Leaves
    const leaveStatusToFetch = user?.role === 'project_coordinator' ? 'pending_coordinator' : 'pending_manager';
    const unsubLeaves = subscribeToLeavesForRole(user?.role || '', user?.uid || '', (data: LeaveRequest[]) => {
      setLeaves(data.filter(l => l.status === leaveStatusToFetch));
    });

    // 3. Subscribe to Expenses
    const expenseStatusToFetch = user?.role === 'project_coordinator' ? 'pending_coordinator' : 'pending_manager';
    const unsubExpenses = subscribeToExpensesForRole(user?.role || '', user?.uid || '', (data: ExpenseRequest[]) => {
      // Filter the data by the exact status needed for the dashboard
      setExpenses(data.filter(e => e.status === expenseStatusToFetch));
      setIsLoading(false);
    });

    return () => {
      unsubAttendance();
      unsubLeaves();
      unsubExpenses();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  const todayStr = getLocalDateString();

  // Compute Today's Stats
  const stats = React.useMemo(() => {
    const todayAttendance = attendance.filter((r) => r.dateStr === todayStr);
    const presentCount = todayAttendance.length;
    const lateCount = todayAttendance.filter((r) => r.status === 'late').length;
    const pendingLeavesCount = leaves.length;
    const pendingExpensesCount = expenses.length;

    // Get 3 most recent check-ins today
    const recentCheckIns = todayAttendance
      .filter((r) => r.checkIn)
      .slice(0, 3);

    return {
      presentCount,
      lateCount,
      pendingLeavesCount,
      pendingExpensesCount,
      recentCheckIns,
    };
  }, [attendance, leaves, expenses, todayStr]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
          }
        >
          {/* Welcome Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.name}>{user?.displayName ?? 'Supervisor'}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Site Supervisor</Text>
            </View>
          </View>

          {/* Today's Overview Title */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Site Overview</Text>
            <Text style={styles.dateText}>
              {formatDateDDMMYYYY(new Date())}
            </Text>
          </View>

          {/* Stat Cards */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="people" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.statNum}>{stats.presentCount}</Text>
              <Text style={styles.statLabel}>Present Today</Text>
              {stats.lateCount > 0 && (
                <Text style={styles.statSubText}>{stats.lateCount} late check-ins</Text>
              )}
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="calendar" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statNum}>{stats.pendingLeavesCount}</Text>
              <Text style={styles.statLabel}>Pending Leaves</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="receipt" size={20} color={Colors.error} />
              </View>
              <Text style={styles.statNum}>{stats.pendingExpensesCount}</Text>
              <Text style={styles.statLabel}>Pending Expenses</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Employees')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="list" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>View Attendance</Text>
              <Text style={styles.actionDesc}>Check daily logs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Expenses')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="cash" size={24} color="#F9A825" />
              </View>
              <Text style={styles.actionLabel}>Verify Expenses</Text>
              <Text style={styles.actionDesc}>Check employee receipts</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Clock Ins */}
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Clock Ins Today</Text>
            {stats.recentCheckIns.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={32} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>No check-ins registered yet today</Text>
              </View>
            ) : (
              <View style={styles.logList}>
                {stats.recentCheckIns.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logIcon}>
                      <Ionicons name="person-circle" size={32} color={Colors.text.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logEmpName}>{log.employeeName}</Text>
                      {log.checkIn?.location && (
                        <Text style={styles.logLoc} numberOfLines={1}>
                          {log.checkIn.location.address}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.logTime}>{formatTime(log.checkIn?.timestamp)}</Text>
                      {log.status === 'late' && (
                        <View style={styles.lateTag}>
                          <Text style={styles.lateTagTxt}>LATE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: { fontSize: 14, color: Colors.text.secondary, fontWeight: FontWeight.medium },
  name: { fontSize: 22, fontWeight: FontWeight.bold, color: Colors.text.primary, marginTop: 2 },
  roleBadge: {
    backgroundColor: Colors.accent + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  roleText: { color: Colors.accent, fontSize: 11, fontWeight: FontWeight.bold },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: 15 },
  dateText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: FontWeight.semibold },

  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 30 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.secondary, fontWeight: FontWeight.semibold, marginTop: 4 },
  statSubText: { fontSize: 8, color: Colors.warning, fontWeight: FontWeight.bold, marginTop: 2 },

  actionsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: 30 },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary },
  actionDesc: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2 },

  recentSection: { marginTop: 10 },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: Colors.text.tertiary },
  logList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    ...Shadow.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  logIcon: { justifyContent: 'center' },
  logEmpName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary },
  logLoc: { fontSize: FontSize.xs - 1, color: Colors.text.secondary, marginTop: 2 },
  logTime: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary },
  lateTag: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  lateTagTxt: { fontSize: 8, color: Colors.warning, fontWeight: '800' },
});
