import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback, Platform, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserLeaves } from '@/firebase/leaveService';
import { subscribeToUserExpenses } from '@/firebase/expenseService';
import { LeaveRequest, Expense } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    const loadState = async () => {
      try {
        const readStr = await AsyncStorage.getItem(`@notifs_read_${user.uid}`);
        const delStr = await AsyncStorage.getItem(`@notifs_del_${user.uid}`);
        if (readStr) setReadIds(new Set(JSON.parse(readStr)));
        if (delStr) setDeletedIds(new Set(JSON.parse(delStr)));
      } catch (e) {
        console.error('Error loading notification state:', e);
      }
    };
    loadState();
  }, [user?.uid]);

  const handleMarkAsRead = async (id: string) => {
    if (!user?.uid || readIds.has(id)) return;
    const newSet = new Set(readIds);
    newSet.add(id);
    setReadIds(newSet);
    try {
      await AsyncStorage.setItem(`@notifs_read_${user.uid}`, JSON.stringify([...newSet]));
      DeviceEventEmitter.emit('notifications_read_updated');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    const newSet = new Set(readIds);
    notifications.forEach(n => newSet.add(n.id));
    setReadIds(newSet);
    try {
      await AsyncStorage.setItem(`@notifs_read_${user.uid}`, JSON.stringify([...newSet]));
      DeviceEventEmitter.emit('notifications_read_updated');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.uid) return;
    const newSet = new Set(deletedIds);
    newSet.add(id);
    setDeletedIds(newSet);
    try {
      await AsyncStorage.setItem(`@notifs_del_${user.uid}`, JSON.stringify([...newSet]));
      DeviceEventEmitter.emit('notifications_read_updated');
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleNavigate = (type: 'leave' | 'expense') => {
    if (!user) return;
    
    let rootApp = '';
    
    switch (user.role) {
      case 'employee':
        rootApp = 'EmployeeApp';
        break;
      case 'project_manager':
      case 'project_coordinator':
        rootApp = 'ProjectManagementApp';
        break;
      case 'hr_manager':
        rootApp = 'ManagerApp';
        break;
      case 'administrator':
        rootApp = 'AdminApp';
        break;
      case 'finance':
        rootApp = 'FinanceApp';
        break;
    }
    
    if (type === 'leave') {
      if (['employee', 'project_manager', 'project_coordinator', 'hr_manager'].includes(user.role)) {
        navigation.navigate(rootApp, { screen: 'Leave' });
      }
    } else if (type === 'expense') {
      if (['employee', 'project_manager', 'project_coordinator', 'finance'].includes(user.role)) {
        navigation.navigate(rootApp, { screen: 'Expenses' });
      }
    }
  };

  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    if (!user) return;

    let unsubLeaves: () => void;
    let unsubExpenses: () => void;

    unsubLeaves = subscribeToUserLeaves(user.uid, user.role, setLeaves);
    unsubExpenses = subscribeToUserExpenses(user.uid, user.role, setExpenses);

    return () => {
      if (unsubLeaves) unsubLeaves();
      if (unsubExpenses) unsubExpenses();
    };
  }, [user]);

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
      const statusText = leave.status.startsWith('pending') ? 'pending' : leave.status.replace(/_/g, ' ');

      items.push({
        id: `leave_${leave.requestId}`,
        type: 'leave',
        title: isEmployee ? leave.type : `Leave Request — ${leave.employeeId}`,
        description: isEmployee
          ? `Your ${leave.type} request (${leave.startDate} to ${leave.endDate}) is ${statusText}.`
          : `${leave.employeeId} requested ${leave.type} leave from ${leave.startDate} to ${leave.endDate}.`,
        status: leave.status,
        createdAt: leave.actionLogs?.[0]?.timestamp || new Date().toISOString(),
        icon: 'calendar-outline',
        iconColor: statusColor,
        iconBg,
        statusColor,
      });
    });

    expenses.forEach(exp => {
      const statusColor = getStatusColor(exp.status);
      const iconBg = exp.status === 'reimbursed' ? '#F0FDF4' : exp.status === 'rejected' ? '#FEF2F2' : '#EFF6FF';
      const statusText = exp.status.startsWith('pending') ? 'pending' : exp.status.replace(/_/g, ' ');

      items.push({
        id: `expense_${exp.expenseId}`,
        type: 'expense',
        title: isEmployee ? `${exp.category} Expense` : `Expense — ${exp.employeeId}`,
        description: isEmployee
          ? `Your ${exp.category} expense of ₹${exp.amount} is ${statusText}.`
          : `${exp.employeeId} submitted a ${exp.category} expense of ₹${exp.amount}.`,
        status: exp.status,
        createdAt: exp.actionLogs?.[0]?.timestamp || new Date().toISOString(),
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
      if (deletedIds.has(notif.id)) return;
      const dateStr = notif.createdAt?.split('T')[0] ?? '';
      let groupLabel = dateStr;
      if (dateStr === todayStr) groupLabel = 'TODAY';
      else if (dateStr === yesterdayStr) groupLabel = 'YESTERDAY';

      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(notif);
    });
    return groups;
  }, [notifications, deletedIds]);

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
            <TouchableOpacity style={styles.moreButton} onPress={handleMarkAllAsRead}>
              <Ionicons name="checkmark-done-outline" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

            {Object.keys(groupedNotifications).length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>You're all caught up! Nothing here yet.</Text>
              </View>
            )}

            {Object.entries(groupedNotifications).map(([groupLabel, items]) => (
              <View key={groupLabel} style={styles.groupContainer}>
                <Text style={styles.sectionTitle}>{groupLabel}</Text>
                {items.map(item => {
                  const timeStr = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View 
                      key={item.id} 
                      style={[styles.notificationCard, !readIds.has(item.id) && styles.unreadCard]}
                    >
                      <TouchableOpacity 
                        style={styles.cardContent}
                        activeOpacity={0.7}
                        onPress={() => {
                          handleMarkAsRead(item.id);
                          closeDrawer();
                          setTimeout(() => {
                            handleNavigate(item.type);
                          }, 300);
                        }}
                      >
                        <View style={[styles.iconAvatar, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={20} color={item.iconColor} />
                          {!readIds.has(item.id) && <View style={styles.unreadIndicator} />}
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
                              {item.status.startsWith('pending') ? 'Pending' : item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionsRow}>
                        {!readIds.has(item.id) && (
                          <>
                            <TouchableOpacity 
                              style={styles.actionButton} 
                              onPress={() => handleMarkAsRead(item.id)}
                            >
                              <Ionicons name="checkmark" size={16} color={Colors.text.secondary} />
                              <Text style={styles.actionText}>Mark as read</Text>
                            </TouchableOpacity>
                            <View style={styles.verticalDivider} />
                          </>
                        )}
                        <TouchableOpacity 
                          style={styles.actionButton} 
                          onPress={() => handleDelete(item.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color={Colors.error} />
                          <Text style={[styles.actionText, { color: Colors.error }]}>Remove</Text>
                        </TouchableOpacity>
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
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: {
    flexDirection: 'row',
    padding: Spacing.md,
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  actionText: {
    fontSize: 12,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  unreadCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 'auto',
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
