import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { subscribeToUserNotifications, AppNotification } from '@/firebase/notificationService';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function GlobalNotificationToast() {
  const { user } = useAuthStore();
  const navigation = useNavigation<NavigationProp<any>>();
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  const prevIdsRef = useRef<Set<string> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      prevIdsRef.current = null;
      return;
    }

    const unsubscribe = subscribeToUserNotifications(user.uid, async (notifications) => {
      // Filter out deleted
      try {
        const delStr = await AsyncStorage.getItem(`@notifs_del_${user.uid}`);
        const delIds = delStr ? new Set(JSON.parse(delStr)) : new Set();
        const activeNotifs = notifications.filter(n => !delIds.has(n.notifId));
        
        const currentIds = new Set(activeNotifs.map(n => n.notifId));
        
        // If this is the initial load, just store IDs and return
        if (prevIdsRef.current === null) {
          prevIdsRef.current = currentIds;
          return;
        }

        // Check for new notifications
        for (const notif of activeNotifs) {
          if (!prevIdsRef.current.has(notif.notifId) && !notif.isRead) {
            // Found a new unread notification
            showBanner(notif);
            break; // Show only the newest one
          }
        }
        
        prevIdsRef.current = currentIds;
      } catch (e) {
        console.error(e);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const showBanner = (notif: AppNotification) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setActiveBanner(notif);
    
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 50, // Distance from top
        useNativeDriver: true,
        bounciness: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();

    // Auto dismiss after 4 seconds
    timerRef.current = setTimeout(() => {
      hideBanner();
    }, 4000);
  };

  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setTimeout(() => setActiveBanner(null), 300);
    });
  };

  const handlePress = () => {
    hideBanner();
    
    // Navigate based on module
    let rootApp = '';
    switch (user?.role) {
      case 'employee': rootApp = 'EmployeeApp'; break;
      case 'project_manager':
      case 'project_coordinator': rootApp = 'ProjectManagementApp'; break;
      case 'hr_manager': rootApp = 'ManagerApp'; break;
      case 'administrator': rootApp = 'AdminApp'; break;
      case 'finance': rootApp = 'FinanceApp'; break;
    }
    
    if (activeBanner?.module === 'leave') {
      navigation.navigate(rootApp, { screen: 'Leave' });
    } else if (activeBanner?.module === 'expense' || activeBanner?.module === 'expenses') {
      navigation.navigate(rootApp, { screen: 'Expenses' });
    } else if (activeBanner?.module === 'attendance') {
      navigation.navigate(rootApp, { screen: 'Attendance' });
    } else if (activeBanner?.module === 'projects') {
      navigation.navigate(rootApp, { screen: 'Projects' });
    } else if (activeBanner?.module === 'users' || activeBanner?.module === 'roles') {
      navigation.navigate(rootApp, { screen: 'Users' }); 
    } else if (activeBanner?.module === 'settings') {
      navigation.navigate(rootApp, { screen: 'Settings' });
    } else {
      // Just go to notifications screen if we can't determine module
      navigation.navigate(rootApp, { screen: 'Notifications' });
    }
  };

  if (!activeBanner) return null;

  let icon = 'notifications-outline';
  let iconColor = '#3B82F6';
  let iconBg = '#EFF6FF';

  switch(activeBanner.module) {
    case 'leave': icon = 'calendar-outline'; break;
    case 'expense':
    case 'expenses': icon = 'cash-outline'; break;
    case 'attendance': icon = 'time-outline'; break;
    case 'projects': icon = 'briefcase-outline'; break;
    case 'users': 
    case 'roles': icon = 'people-outline'; break;
  }

  if (activeBanner.type === 'success') {
    iconColor = '#16A34A'; iconBg = '#F0FDF4';
  } else if (activeBanner.type === 'error') {
    iconColor = '#EF4444'; iconBg = '#FEF2F2';
  } else if (activeBanner.type === 'warning') {
    iconColor = '#D97706'; iconBg = '#FFFBEB';
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity 
        style={styles.toast} 
        activeOpacity={0.9} 
        onPress={handlePress}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{activeBanner.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{activeBanner.message}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={hideBanner} hitSlop={{top:10, bottom:10, left:10, right:10}}>
          <Ionicons name="close" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 99999,
  },
  toast: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  message: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
