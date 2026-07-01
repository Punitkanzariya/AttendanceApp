import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserLeaves, subscribeToLeavesForRole } from '@/firebase/leaveService';
import { subscribeToUserExpenses, subscribeToExpensesForRole } from '@/firebase/expenseService';
import { LeaveRequest, ExpenseRequest } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH;

type NotificationItem = {
  id: string;
  type: 'leave' | 'expense';
  title: string;
  description: string;
  status: string;
  createdAt: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  statusColor: string;
};

export default function NotificationScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState('Request');
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0.55, duration: 320, useNativeDriver: true })
    ]).start();
  }, [translateX, backdropOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: DRAWER_WIDTH, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true })
    ]).start(() => navigation?.goBack?.());
  }, [translateX, backdropOpacity, navigation]);

  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    if (!user) return;

    let unsubLeaves: () => void;
    let unsubExpenses: () => void;

    if (isEmployee) {
      unsubLeaves = subscribeToUserLeaves(user.uid, user.role, setLeaves);
      unsubExpenses = subscribeToUserExpenses(user.uid, user.role, setExpenses);
    } else {
      unsubLeaves = subscribeToLeavesForRole(user.role, user.uid, setLeaves);
      unsubExpenses = subscribeToExpensesForRole(user.role, user.uid, setExpenses);
    }

    return () => {
      if (unsubLeaves) unsubLeaves();
      if (unsubExpenses) unsubExpenses();
    };
  }, [user, isEmployee]);

  const getStatusColor = (status: string) => {
    if (status === 'approved' || status === 'reimbursed') return '#16A34A';
    if (status === 'rejected') return '#EF4444';
    return '#D97706';
  };

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    leaves.forEach(leave => {
      const statusColor = getStatusColor(leave.status);
      const iconBg = leave.status === 'approved' ? '#F0FDF4' : leave.status === 'rejected' ? '#FEF2F2' : '#EFF6FF';
      const statusText = leave.status.replace(/_/g, ' ');

      items.push({
        id: `leave_${leave.id}`,
        type: 'leave',
        title: isEmployee ? `${leave.leaveType} Leave` : `Leave Request — ${leave.employeeName}`,
        description: isEmployee
          ? `Your ${leave.leaveType} request (${leave.startDate} to ${leave.endDate}) is ${statusText}.`
          : `${leave.employeeName} requested ${leave.leaveType} leave from ${leave.startDate} to ${leave.endDate}.`,
        status: leave.status,
        createdAt: leave.createdAt,
        icon: 'calendar-outline',
        iconColor: statusColor,
        iconBg,
        statusColor,
      });
    });

    expenses.forEach(exp => {
      const statusColor = getStatusColor(exp.status);
      const iconBg = exp.status === 'reimbursed' ? '#F0FDF4' : exp.status === 'rejected' ? '#FEF2F2' : '#EFF6FF';
      const statusText = exp.status.replace(/_/g, ' ');

      items.push({
        id: `expense_${exp.id}`,
        type: 'expense',
        title: isEmployee ? `${exp.category} Expense` : `Expense — ${exp.employeeName}`,
        description: isEmployee
          ? `Your ${exp.category} expense of ₹${exp.amount} is ${statusText}.`
          : `${exp.employeeName} submitted a ${exp.category} expense of ₹${exp.amount}.`,
        status: exp.status,
        createdAt: exp.createdAt,
        icon: 'cash-outline',
        iconColor: statusColor,
        iconBg,
        statusColor,
      });
    });

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [leaves, expenses, isEmployee]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: NotificationItem[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    notifications.forEach(notif => {
      const dateStr = notif.createdAt?.split('T')[0] ?? '';
      let groupLabel = dateStr;
      if (dateStr === todayStr) groupLabel = 'TODAY';
      else if (dateStr === yesterdayStr) groupLabel = 'YESTERDAY';

      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(notif);
    });
    return groups;
  }, [notifications]);

  return (
    <View style={styles.rootContainer}>
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX }],
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 8 },
              android: { elevation: 12 },
            }),
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={closeDrawer}>
              <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.moreButton} />
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'General' && styles.activeTab]}
              onPress={() => setActiveTab('General')}
            >
              <Text style={[styles.tabText, activeTab === 'General' && styles.activeTabText]}>General</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'Request' && styles.activeTab]}
              onPress={() => setActiveTab('Request')}
            >
              <Text style={[styles.tabText, activeTab === 'Request' && styles.activeTabText]}>
                {isEmployee ? 'Updates' : 'Requests'}
              </Text>
              {notifications.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifications.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

            {/* General Tab */}
            {activeTab === 'General' && (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No General Announcements</Text>
                <Text style={styles.emptySubtitle}>Company-wide announcements will appear here.</Text>
              </View>
            )}

            {/* Request/Updates Tab - Empty */}
            {activeTab !== 'General' && Object.keys(groupedNotifications).length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>You're all caught up! Nothing here yet.</Text>
              </View>
            )}

            {/* Request/Updates Tab - List */}
            {activeTab !== 'General' && Object.entries(groupedNotifications).map(([groupLabel, items]) => (
              <View key={groupLabel} style={styles.groupContainer}>
                <Text style={styles.sectionTitle}>{groupLabel}</Text>
                {items.map(item => {
                  const timeStr = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={item.id} style={styles.notificationCard}>
                      <View style={[styles.iconAvatar, { backgroundColor: item.iconBg }]}>
                        <Ionicons name={item.icon} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.textContainer}>
                        <View style={styles.titleRow}>
                          <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.timeText}>{timeStr}</Text>
                        </View>
                        <Text style={styles.notificationText}>{item.description}</Text>
                        <View style={[styles.statusPill, { backgroundColor: item.statusColor + '18' }]}>
                          <View style={[styles.statusDot, { backgroundColor: item.statusColor }]} />
                          <Text style={[styles.statusLabel, { color: item.statusColor }]}>
                            {item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40, height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  moreButton: {
    width: 40, height: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
  activeTabText: {
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 80,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.secondary,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  groupContainer: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    letterSpacing: 0.8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.xs,
  },
  timeText: {
    fontSize: 10,
    color: Colors.text.tertiary,
    flexShrink: 0,
  },
  notificationText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
});
