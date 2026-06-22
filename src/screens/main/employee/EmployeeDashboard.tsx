import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { EmployeeTabParamList, AttendanceRecord } from '@/types';
import { subscribeToTodayAttendance } from '@/firebase';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToTodayAttendance(user.uid, (record) => {
      setTodayRecord(record);
    });
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getWorkingHoursText = () => {
    if (!todayRecord) return '--';
    if (!todayRecord.checkOut) return 'In Progress';
    return `${todayRecord.workingHours} hrs`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} tintColor="#2E7D32" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.locationContainer}>
            <View style={styles.locationIconWrap}>
              <Ionicons name="location" size={20} color={Colors.text.secondary} />
            </View>
            <View>
              <Text style={styles.locationLabelTxt}>LOCATION</Text>
              <Text style={styles.dateText}>Thambu chetty st,chennai</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={18} color={Colors.text.primary} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarInitials}>
                {user?.displayName ? user.displayName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'EM'}
              </Text>
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.pageTitle}>Welcome,{user?.displayName ?? 'User'}</Text>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Clock In</Text>
              <Text style={styles.summaryValue}>{formatTime(todayRecord?.checkIn?.timestamp)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Clock Out</Text>
              <Text style={styles.summaryValue}>{formatTime(todayRecord?.checkOut?.timestamp)}</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.clockBtn,
                todayRecord?.checkIn && todayRecord?.checkOut && { backgroundColor: Colors.text.tertiary }
              ]} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Attendance')}
              disabled={!!(todayRecord?.checkIn && todayRecord?.checkOut)}
            >
              <Text style={styles.clockBtnTxt}>
                {!todayRecord ? 'Clock In Now' : !todayRecord.checkOut ? 'Clock Out Now' : 'Completed'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 4 }} />
          <View>
            <Text style={styles.summaryLabel}>Working Hours</Text>
            <Text style={styles.summaryValue}>{getWorkingHoursText()}</Text>
          </View>
        </View>

        {/* Attendance for this Month */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Attendance for this Month</Text>
          <TouchableOpacity style={styles.monthBtn} activeOpacity={0.7}>
            <Text style={styles.monthBtnTxt}>APR</Text>
            <Ionicons name="calendar-outline" size={12} color="#2563EB" />
          </TouchableOpacity>
        </View>
        <View style={styles.attendanceGrid}>
          <View style={[styles.attCard, { backgroundColor: '#E8F5E9', borderTopColor: '#2E7D32' }]}>
            <Text style={styles.attLabel}>Present</Text>
            <Text style={[styles.attNum, { color: '#2E7D32' }]}>13</Text>
          </View>
          <View style={[styles.attCard, { backgroundColor: '#FFEBEE', borderTopColor: '#C62828' }]}>
            <Text style={styles.attLabel}>Absents</Text>
            <Text style={[styles.attNum, { color: '#C62828' }]}>02</Text>
          </View>
          <View style={[styles.attCard, { backgroundColor: '#FFF8E1', borderTopColor: '#F9A825' }]}>
            <Text style={styles.attLabel}>Late in</Text>
            <Text style={[styles.attNum, { color: '#F9A825' }]}>04</Text>
          </View>
        </View>

        {/* Leave Balance */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Leave Balance</Text>
        </View>
        <View style={styles.leaveGrid}>
          <View style={styles.leaveRow}>
            <View style={styles.leaveCard}>
              <View style={[styles.leaveIconRing, { borderColor: '#2E7D32' }]}>
                <Ionicons name="briefcase-outline" size={16} color={Colors.text.primary} />
              </View>
              <View>
                <Text style={styles.leaveNum}>12 <Text style={styles.leaveTotalTxt}>/ 15 Days</Text></Text>
                <Text style={styles.leaveLabel}>Paid Leave</Text>
                <Text style={styles.leaveTakenTxt}>3 Taken</Text>
              </View>
            </View>
            <View style={styles.leaveCard}>
              <View style={[styles.leaveIconRing, { borderColor: '#2563EB' }]}>
                <Ionicons name="briefcase-outline" size={16} color={Colors.text.primary} />
              </View>
              <View>
                <Text style={styles.leaveNum}>7 <Text style={styles.leaveTotalTxt}>/ 10 Days</Text></Text>
                <Text style={styles.leaveLabel}>Sick Leave</Text>
                <Text style={styles.leaveTakenTxt}>3 Taken</Text>
              </View>
            </View>
          </View>
          <View style={styles.leaveRow}>
            <View style={styles.leaveCard}>
              <View style={[styles.leaveIconRing, { borderColor: '#F59E0B' }]}>
                <Ionicons name="briefcase-outline" size={16} color={Colors.text.primary} />
              </View>
              <View>
                <Text style={styles.leaveNum}>5 <Text style={styles.leaveTotalTxt}>/ 8 Days</Text></Text>
                <Text style={styles.leaveLabel}>Casual Leave</Text>
                <Text style={styles.leaveTakenTxt}>3 Taken</Text>
              </View>
            </View>
            <View style={styles.leaveCard}>
              <View style={[styles.leaveIconRing, { borderColor: '#8B5CF6' }]}>
                <Ionicons name="briefcase-outline" size={16} color={Colors.text.primary} />
              </View>
              <View>
                <Text style={styles.leaveNum}>24 <Text style={styles.leaveTotalTxt}>/ 33 Days</Text></Text>
                <Text style={styles.leaveLabel}>Total Leave</Text>
                <Text style={styles.leaveTakenTxt}>9 Taken</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.employeeBg },
  container: { padding: 20, paddingBottom: Spacing.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  locationLabelTxt: { fontSize: 10, color: Colors.text.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  dateText: { fontSize: 13, color: Colors.text.primary, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: { 
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.white, 
    alignItems: 'center', justifyContent: 'center' 
  },
  notificationDot: { 
    position: 'absolute', top: 8, right: 10, width: 6, height: 6, 
    borderRadius: 3, backgroundColor: Colors.error 
  },
  avatarWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#475569',
    alignItems: 'center', justifyContent: 'center'
  },
  avatarInitials: { color: Colors.white, fontSize: 12, fontWeight: '700' },

  pageTitle: { fontSize: 25, fontWeight: '700', color: Colors.text.primary, lineHeight: 34, marginBottom: 15 },

  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 40, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  clockBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  clockBtnTxt: { color: Colors.white, fontWeight: '600', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  monthBtnTxt: { color: '#2563EB', fontSize: 11, fontWeight: '600' },
  
  attendanceGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 30 },
  attCard: { flex: 1, borderRadius: 8, padding: 10, borderTopWidth: 4, borderWidth: 1, borderColor: Colors.border, height: 75, justifyContent: 'space-between' },
  attLabel: { fontSize: 11, color: Colors.text.primary, fontWeight: '600' },
  attNum: { fontSize: 18, fontWeight: '700', alignSelf: 'flex-end' },

  leaveGrid: { flexDirection: 'column', gap: Spacing.sm, marginBottom: 40 },
  leaveRow: { flexDirection: 'row', gap: Spacing.sm },
  leaveCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
  leaveIconRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  leaveNum: { fontSize: 13, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  leaveTotalTxt: { fontSize: 10, color: Colors.text.secondary, fontWeight: '500' },
  leaveLabel: { fontSize: 10, color: Colors.text.secondary },
  leaveTakenTxt: { fontSize: 9, color: '#64748B', marginTop: 2, fontWeight: '500' },
});
