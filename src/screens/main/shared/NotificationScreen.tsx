import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback, Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, AppNotification } from '@/firebase/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH;

export default function NotificationScreen({ navigation }: any) {
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    const loadState = async () => {
      try {
        const delStr = await AsyncStorage.getItem(`@notifs_del_${user.uid}`);
        if (delStr) setDeletedIds(new Set(JSON.parse(delStr)));
      } catch (e) {
        console.error('Error loading notification state:', e);
      }
    };
    loadState();
  }, [user?.uid]);

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

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserNotifications(user.uid, (data) => {
      setNotifications(data);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    if (!user?.uid) return;
    try {
      await markNotificationAsRead(user.uid, id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    try {
      await markAllNotificationsAsRead(user.uid);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigate = (moduleName?: string, link?: string) => {
    if (!user) return;
    
    // If a custom deep link is provided, we could use Linking.openURL, but for now we rely on internal navigation
    
    let rootApp = '';
    switch (user.role) {
      case 'employee': rootApp = 'EmployeeApp'; break;
      case 'project_manager':
      case 'project_coordinator': rootApp = 'ProjectManagementApp'; break;
      case 'hr_manager': rootApp = 'ManagerApp'; break;
      case 'administrator': rootApp = 'AdminApp'; break;
      case 'finance': rootApp = 'FinanceApp'; break;
    }
    
    // Module-based navigation mapping
    if (moduleName === 'leave') {
      navigation.navigate(rootApp, { screen: 'Leave' });
    } else if (moduleName === 'expense' || moduleName === 'expenses') {
      navigation.navigate(rootApp, { screen: 'Expenses' });
    } else if (moduleName === 'attendance') {
      navigation.navigate(rootApp, { screen: 'Attendance' });
    } else if (moduleName === 'projects') {
      navigation.navigate(rootApp, { screen: 'Projects' });
    } else if (moduleName === 'users' || moduleName === 'roles') {
      navigation.navigate(rootApp, { screen: 'Users' }); // Assuming there is a Users or Employees screen
    } else if (moduleName === 'settings') {
      navigation.navigate(rootApp, { screen: 'Settings' });
    } else if (link) {
      // Fallback to try and navigate using a generic link string if possible
      console.log('Would navigate to custom link:', link);
    }
  };

  const getIconConfig = (type: string, module?: string) => {
    let icon = 'notifications-outline';
    
    // Assign specific icons based on the module
    switch(module) {
      case 'leave': icon = 'calendar-outline'; break;
      case 'expense':
      case 'expenses': icon = 'cash-outline'; break;
      case 'attendance': icon = 'time-outline'; break;
      case 'projects': icon = 'briefcase-outline'; break;
      case 'users': 
      case 'roles': icon = 'people-outline'; break;
      case 'settings': icon = 'settings-outline'; break;
      case 'system': icon = 'server-outline'; break;
    }

    let iconColor = '#3B82F6'; // Default info blue
    let iconBg = '#EFF6FF';

    // Override colors based on notification type
    if (type === 'success') {
      iconColor = '#16A34A';
      iconBg = '#F0FDF4';
    } else if (type === 'error') {
      iconColor = '#EF4444';
      iconBg = '#FEF2F2';
    } else if (type === 'warning') {
      iconColor = '#D97706';
      iconBg = '#FFFBEB';
    }

    return { icon, iconColor, iconBg };
  };

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: AppNotification[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    notifications.forEach(notif => {
      if (deletedIds.has(notif.notifId)) return;
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
                  const { icon, iconColor, iconBg } = getIconConfig(item.type, item.module);
                  
                  return (
                    <View 
                      key={item.notifId} 
                      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
                    >
                      <TouchableOpacity 
                        style={styles.cardContent}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!item.isRead) {
                            handleMarkAsRead(item.notifId);
                          }
                          closeDrawer();
                          setTimeout(() => {
                            handleNavigate(item.module, item.link);
                          }, 300);
                        }}
                      >
                        <View style={[styles.iconAvatar, { backgroundColor: iconBg }]}>
                          <Ionicons name={icon as any} size={20} color={iconColor} />
                          {!item.isRead && <View style={styles.unreadIndicator} />}
                        </View>
                        
                        <View style={styles.textContent}>
                          <View style={styles.titleRow}>
                            <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.timeText}>{timeStr}</Text>
                          </View>
                          <Text style={styles.notificationText}>{item.message}</Text>
                          
                          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4}}>
                            <View style={[styles.statusPill, { backgroundColor: iconColor + '18' }]}>
                              <View style={[styles.statusDot, { backgroundColor: iconColor }]} />
                              <Text style={[styles.statusLabel, { color: iconColor }]}>
                                {item.module ? item.module.charAt(0).toUpperCase() + item.module.slice(1) : 'Notification'}
                              </Text>
                            </View>


                          </View>
                          
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionsRow}>
                        {!item.isRead && (
                          <>
                            <TouchableOpacity 
                              style={styles.actionButton} 
                              onPress={() => handleMarkAsRead(item.notifId)}
                            >
                              <Ionicons name="checkmark" size={16} color={Colors.text.secondary} />
                              <Text style={styles.actionText}>Mark as read</Text>
                            </TouchableOpacity>
                            <View style={styles.verticalDivider} />
                          </>
                        )}
                        <TouchableOpacity 
                          style={styles.actionButton} 
                          onPress={() => handleDelete(item.notifId)}
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
            
            <View style={{ height: Spacing.xl }} />
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  scrollContainer: {
    padding: Spacing.md,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['3xl'] * 2,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  groupContainer: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  unreadCard: {
    backgroundColor: '#F0F9FF', 
    borderColor: '#BAE6FD',
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
  iconAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  notificationTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  notificationText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  senderPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F1F5F9',
    marginTop: Spacing.xs,
  },
  senderText: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
});
