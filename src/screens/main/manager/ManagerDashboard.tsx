import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ManagerTabParamList, AttendanceRecord, LeaveRequest, ExpenseRequest } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import {
  subscribeToAllAttendance,
  subscribeToAllLeaves,
  subscribeToAllExpenses,
  updateLeaveStatus,
  updateExpenseStatus,
  getLocalDateString,
} from '@/firebase';

type FeedItem =
  | { type: 'leave'; id: string; name: string; title: string; subtitle: string; date: string; raw: LeaveRequest }
  | { type: 'expense'; id: string; name: string; title: string; subtitle: string; date: string; raw: ExpenseRequest };

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<BottomTabNavigationProp<ManagerTabParamList>>();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
    const unsubLeaves = subscribeToAllLeaves((data: LeaveRequest[]) => {
      setLeaves(data);
    });

    // 3. Subscribe to Expenses
    const unsubExpenses = subscribeToAllExpenses(['pending_manager'], (data: ExpenseRequest[]) => {
      setExpenses(data);
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

  // Compute stats and quick approvals feed
  const stats = React.useMemo(() => {
    const todayAttendance = attendance.filter((r) => r.dateStr === todayStr);
    const presentCount = todayAttendance.length;
    const lateCount = todayAttendance.filter((r) => r.status === 'late').length;

    const pendingLeaves = leaves.filter((l) => l.status === 'pending');
    const pendingExpenses = expenses;

    // Build consolidated Quick Approvals feed (max 3 items)
    const feed: FeedItem[] = [];

    pendingLeaves.forEach((l) => {
      feed.push({
        type: 'leave',
        id: l.id,
        name: l.employeeName,
        title: `${l.leaveType} (${l.totalDays} Days)`,
        subtitle: `Reason: ${l.reason}`,
        date: `${l.startDate} to ${l.endDate}`,
        raw: l,
      });
    });

    pendingExpenses.forEach((e) => {
      feed.push({
        type: 'expense',
        id: e.id,
        name: e.employeeName,
        title: `Expense: ${e.category} (₹${e.amount})`,
        subtitle: `Desc: ${e.description}`,
        date: e.date,
        raw: e,
      });
    });

    // Sort by timestamp if available, otherwise just slice first 3
    const feedPreview = feed.slice(0, 3);

    return {
      presentCount,
      lateCount,
      pendingLeavesCount: pendingLeaves.length,
      pendingExpensesCount: pendingExpenses.length,
      feedPreview,
    };
  }, [attendance, leaves, expenses, todayStr]);

  // Inline Quick Approvals Handlers
  const handleApprove = async (item: FeedItem) => {
    if (!user?.uid) return;
    setProcessingId(item.id);
    try {
      if (item.type === 'leave') {
        await updateLeaveStatus(item.id, item.employeeId, item.role, 'approved', user.uid, 'Quick approved from Dashboard');
        Alert.alert('Approved', 'Leave request approved!');
      } else {
        // Manager approval pushes expense to pending_finance status
        await updateExpenseStatus(item.id, item.employeeId, item.role, 'pending_finance', user.uid);
        Alert.alert('Approved', 'Expense request approved and sent to Finance!');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: FeedItem) => {
    if (!user?.uid) return;

    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              if (item.type === 'leave') {
                await updateLeaveStatus(item.id, item.employeeId, item.role, 'rejected', user.uid, 'Rejected from Dashboard');
                Alert.alert('Rejected', 'Leave request rejected.');
              } else {
                await updateExpenseStatus(item.id, item.employeeId, item.role, 'rejected', user.uid, 'Rejected from Dashboard');
                Alert.alert('Rejected', 'Expense request rejected.');
              }
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', 'Failed to reject request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />
          }
        >
          {/* Welcome Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.name}>{user?.displayName ?? 'Manager'}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Manager</Text>
            </View>
          </View>

          {/* Stats Title */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team Summary</Text>
            <Text style={styles.dateText}>
              {formatDateDDMMYYYY(new Date())}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="people" size={18} color="#0284C7" />
              </View>
              <Text style={styles.statNum}>{stats.presentCount}</Text>
              <Text style={styles.statLabel}>Present Today</Text>
              {stats.lateCount > 0 && (
                <Text style={styles.statSubText}>{stats.lateCount} Late In</Text>
              )}
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="calendar" size={18} color="#9333EA" />
              </View>
              <Text style={styles.statNum}>{stats.pendingLeavesCount}</Text>
              <Text style={styles.statLabel}>Pending Leaves</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="cash" size={18} color="#EA580C" />
              </View>
              <Text style={styles.statNum}>{stats.pendingExpensesCount}</Text>
              <Text style={styles.statLabel}>Pending Expenses</Text>
            </View>
          </View>

          {/* Quick Actions Shortcuts */}
          <Text style={styles.sectionTitle}>Quick Shortcuts</Text>
          <View style={styles.shortcutsGrid}>
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('TeamAttendance')}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={24} color={Colors.secondary} />
              <Text style={styles.shortcutLabel}>Team Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Leave')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={24} color={Colors.secondary} />
              <Text style={styles.shortcutLabel}>Approve Leaves</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Expenses')}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={24} color={Colors.secondary} />
              <Text style={styles.shortcutLabel}>Approve Expenses</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Approvals Feed */}
          <View style={styles.feedSection}>
            <Text style={styles.sectionTitle}>Quick Approvals Queue</Text>
            {stats.feedPreview.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkbox-outline" size={32} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>All caught up! No pending approvals.</Text>
              </View>
            ) : (
              stats.feedPreview.map((item) => {
                const isProcessing = processingId === item.id;
                const isLeave = item.type === 'leave';

                return (
                  <View key={item.id} style={styles.feedCard}>
                    {/* Header */}
                    <View style={styles.feedHeader}>
                      <View style={styles.feedMeta}>
                        <View
                          style={[
                            styles.typeBadge,
                            { backgroundColor: isLeave ? '#F3E8FF' : '#FFF7ED' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeText,
                              { color: isLeave ? '#9333EA' : '#EA580C' },
                            ]}
                          >
                            {item.type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.employeeName}>{item.name}</Text>
                      </View>
                    </View>

                    {/* Content */}
                    <Text style={styles.feedTitle}>{item.title}</Text>
                    <Text style={styles.feedSubtitle}>{item.subtitle}</Text>
                    <Text style={styles.feedDate}>{item.date}</Text>

                    {/* Actions */}
                    <View style={styles.feedActions}>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={Colors.secondary} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.feedBtn, styles.feedBtnReject]}
                            onPress={() => handleReject(item)}
                          >
                            <Text style={styles.rejectText}>Reject</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.feedBtn, styles.feedBtnApprove]}
                            onPress={() => handleApprove(item)}
                          >
                            <Text style={styles.approveText}>Approve</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })
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
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  roleText: { color: Colors.secondary, fontSize: 11, fontWeight: FontWeight.bold },

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
  statSubText: { fontSize: 8, color: Colors.error, fontWeight: FontWeight.bold, marginTop: 2 },

  shortcutsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 30,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    ...Shadow.sm,
  },
  shortcutLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },

  feedSection: { marginTop: 10 },
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

  feedCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    ...Shadow.sm,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: FontSize.xs - 3,
    fontWeight: '800',
  },
  employeeName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  feedTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginTop: 4,
  },
  feedSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  feedDate: {
    fontSize: FontSize.xs - 1,
    color: Colors.text.tertiary,
    marginTop: 6,
    fontWeight: FontWeight.medium,
  },
  feedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
  },
  feedBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  feedBtnReject: {
    borderColor: Colors.error + '40',
    backgroundColor: '#FEF2F2',
  },
  rejectText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.error,
  },
  feedBtnApprove: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  approveText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
});
