import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH;

export default function NotificationScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState('Request');
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={closeDrawer}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

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
          <Text style={[styles.tabText, activeTab === 'Request' && styles.activeTabText]}>Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>TODAY</Text>

        {/* Item 1 */}
        <View style={styles.notificationItem}>
          <View style={styles.notificationContent}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
              style={styles.avatar} 
            />
            <View style={styles.textContainer}>
              <Text style={styles.notificationText}>
                <Text style={styles.boldText}>Rama raja</Text> has not logged in yet today. Please review their attendance status.
              </Text>
              <Text style={styles.timeText}>11:30 AM</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionBtn, styles.attendanceBtn]}>
              <Text style={styles.attendanceBtnText}>Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.sendBtn]}>
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Item 2 */}
        <View style={styles.notificationItem}>
          <View style={styles.notificationContent}>
            <View style={styles.iconAvatar}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.notificationText}>
                <Text style={styles.boldText}>Rama raja</Text> has requested <Text style={styles.boldText}>Sick Leave</Text> for [15-04-2025].
              </Text>
              <Text style={styles.timeText}>10:30 AM</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionBtn, styles.denyBtn]}>
              <Text style={styles.denyBtnText}>Denied</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]}>
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>YESTERDAY</Text>

        {/* Item 3 */}
        <View style={styles.notificationItem}>
          <View style={styles.notificationContent}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
              style={styles.avatar} 
            />
            <View style={styles.textContainer}>
              <Text style={styles.notificationText}>
                <Text style={styles.boldText}>Rama raja</Text> has not logged in yet today. Please review their attendance status.
              </Text>
              <Text style={styles.timeText}>11:30 AM</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={20} color="#16A34A" />
            <Text style={styles.statusText}>Notification Send</Text>
          </View>
        </View>

        {/* Item 4 */}
        <View style={styles.notificationItem}>
          <View style={styles.notificationContent}>
            <View style={styles.iconAvatar}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.notificationText}>
                <Text style={styles.boldText}>Rama raja</Text> has requested <Text style={styles.boldText}>Sick Leave</Text> for [15-04-2025].
              </Text>
              <Text style={styles.timeText}>10:30 AM</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={20} color="#16A34A" />
            <Text style={styles.statusText}>Approved</Text>
          </View>
        </View>

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
    right: 0,
    bottom: 0,
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
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
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
  scrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  notificationItem: {
    marginBottom: Spacing.md,
  },
  notificationContent: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: Spacing.sm,
  },
  iconAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  boldText: {
    color: '#2563EB',
    fontWeight: FontWeight.semibold,
  },
  timeText: {
    fontSize: 10,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingLeft: 36 + Spacing.sm, // avatar width + margin
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  attendanceBtn: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  attendanceBtnText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: FontWeight.medium,
  },
  sendBtn: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  sendBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: FontWeight.medium,
  },
  denyBtn: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  denyBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: FontWeight.medium,
  },
  approveBtn: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  approveBtnText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: FontWeight.medium,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36 + Spacing.sm,
    marginTop: 2,
  },
  statusText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.xs,
  },
});
