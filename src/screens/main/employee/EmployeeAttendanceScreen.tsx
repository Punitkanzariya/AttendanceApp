import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import {
  subscribeToTodayAttendance,
  checkInEmployee,
  checkOutEmployee,
  subscribeToUserAttendanceHistory,
  getLocalDateString
} from '@/firebase';
import type { AttendanceRecord, AttendanceLocation } from '@/types';

export default function EmployeeAttendanceScreen() {
  const { user } = useAuthStore();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Time & Timer states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeHoursStr, setActiveHoursStr] = useState('00:00:00');

  // Input states
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location states
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Keep a reference to the active timer interval
  const timerIntervalRef = useRef<any>(null);

  // Current live clock update
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Location request function
  const fetchLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied. Attendance tagging requires location.');
        setLocationLoading(false);
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocationCoords(coords);

      // Reverse geocode for readable address
      try {
        const geocodes = await Location.reverseGeocodeAsync(coords);
        if (geocodes && geocodes.length > 0) {
          const item = geocodes[0];
          const addressParts = [
            item.name,
            item.street,
            item.district,
            item.city,
            item.region,
            item.postalCode,
          ].filter(Boolean);
          const formattedAddress = addressParts.slice(0, 4).join(', ');
          setLocationAddress(formattedAddress || 'Resolved Location');
        } else {
          setLocationAddress(`Lat: ${coords.latitude.toFixed(4)}, Lon: ${coords.longitude.toFixed(4)}`);
        }
      } catch (err) {
        setLocationAddress(`Lat: ${coords.latitude.toFixed(4)}, Lon: ${coords.longitude.toFixed(4)}`);
      }

      setLocationLoading(false);
      return coords;
    } catch (err: any) {
      console.error('Error fetching location:', err);
      setLocationError('Could not fetch GPS coordinates. Please check your GPS settings.');
      setLocationLoading(false);
      return null;
    }
  }, []);

  // Fetch location on load
  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Subscribe to today's attendance and history
  useEffect(() => {
    if (!user?.uid) return;

    const unsubToday = subscribeToTodayAttendance(user.uid, (record) => {
      setTodayRecord(record);
      setLoadingRecord(false);
    });

    const unsubHistory = subscribeToUserAttendanceHistory(user.uid, (records) => {
      // Exclude today's record from history list to avoid duplication
      const todayStr = getLocalDateString();
      const filtered = records.filter(r => r.dateStr !== todayStr);
      setHistory(filtered);
    });

    return () => {
      unsubToday();
      unsubHistory();
    };
  }, [user?.uid]);

  // Handle active working hours running timer (if checked in but not checked out)
  useEffect(() => {
    if (todayRecord?.checkIn && !todayRecord.checkOut) {
      const checkInTime = new Date(todayRecord.checkIn.timestamp).getTime();

      const updateActiveTimer = () => {
        const elapsedMs = Date.now() - checkInTime;
        const secs = Math.floor(elapsedMs / 1000) % 60;
        const mins = Math.floor(elapsedMs / (1000 * 60)) % 60;
        const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
        setActiveHoursStr(
          `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      };

      updateActiveTimer();
      timerIntervalRef.current = setInterval(updateActiveTimer, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setActiveHoursStr('00:00:00');
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [todayRecord]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLocation();
    setRefreshing(false);
  }, [fetchLocation]);

  const handleAction = async () => {
    if (!user?.uid) return;

    // Trigger loading state
    setIsSubmitting(true);

    try {
      // Re-fetch location to ensure accuracy at the moment of clock-in/out
      const coords = await fetchLocation();
      if (!coords) {
        Alert.alert('Location Required', 'Cannot log attendance without GPS location. Please allow location access.');
        setIsSubmitting(false);
        return;
      }

      const attendanceLoc: AttendanceLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: locationAddress || 'GPS Location',
      };

      if (!todayRecord) {
        // Clock In
        await checkInEmployee(user.uid, user.displayName || 'Employee', attendanceLoc, remark);
        Alert.alert('Success', 'Clocked in successfully!');
      } else if (!todayRecord.checkOut) {
        // Clock Out
        await checkOutEmployee(user.uid, attendanceLoc, remark);
        Alert.alert('Success', 'Clocked out successfully!');
      }
      setRemark('');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format timestamps to hh:mm A
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render Status Badge
  const getStatusInfo = () => {
    if (!todayRecord) {
      return { label: 'Absent (Not Clocked In)', color: Colors.error, bg: '#FEF2F2', icon: 'log-in-outline' };
    }
    if (!todayRecord.checkOut) {
      return {
        label: todayRecord.status === 'late' ? 'Clocked In (Late)' : 'Clocked In',
        color: todayRecord.status === 'late' ? Colors.warning : Colors.success,
        bg: todayRecord.status === 'late' ? '#FFFBEB' : '#F0FDF4',
        icon: 'time-outline',
      };
    }
    return { label: 'Clocked Out', color: Colors.text.secondary, bg: '#F1F5F9', icon: 'log-out-outline' };
  };

  const statusInfo = getStatusInfo();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Mark Attendance</Text>
            <Text style={styles.subtitle}>
              {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
          </View>

          {/* Current Live Time Display */}
          <View style={styles.clockContainer}>
            <Text style={styles.liveClock}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.color + '40' }]}>
              <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {/* Large Action Circle */}
          <View style={styles.actionCenter}>
            <TouchableOpacity
              style={[
                styles.actionCircle,
                isSubmitting && styles.actionCircleDisabled,
                !todayRecord
                  ? styles.circleClockIn
                  : !todayRecord.checkOut
                  ? styles.circleClockOut
                  : styles.circleCompleted,
              ]}
              onPress={handleAction}
              disabled={isSubmitting || (!!todayRecord && !!todayRecord.checkOut)}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="large" color={Colors.white} />
              ) : (
                <View style={styles.circleContent}>
                  <Ionicons
                    name={
                      !todayRecord
                        ? 'finger-print-outline'
                        : !todayRecord.checkOut
                        ? 'power-outline'
                        : 'checkmark-done-circle-outline'
                    }
                    size={64}
                    color={Colors.white}
                  />
                  <Text style={styles.circleActionText}>
                    {!todayRecord ? 'CLOCK IN' : !todayRecord.checkOut ? 'CLOCK OUT' : 'COMPLETED'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Timer card for active hours */}
          {todayRecord?.checkIn && !todayRecord.checkOut && (
            <View style={styles.timerCard}>
              <Text style={styles.timerTitle}>Active Working Time Today</Text>
              <Text style={styles.timerValue}>{activeHoursStr}</Text>
            </View>
          )}

          {/* Location status card */}
          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <View
                style={[
                  styles.locationIconBg,
                  locationError ? styles.locationIconBgError : styles.locationIconBgSuccess,
                ]}
              >
                <Ionicons
                  name={locationError ? 'warning-outline' : 'location'}
                  size={20}
                  color={locationError ? Colors.error : Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>CURRENT WORK SITE LOCATION</Text>
                {locationLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.locationTextLoading}>Acquiring GPS...</Text>
                  </View>
                ) : (
                  <Text style={[styles.locationText, locationError && styles.locationTextError]}>
                    {locationError || locationAddress || 'Awaiting location signal...'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={fetchLocation}
                disabled={locationLoading}
                style={styles.refreshLocBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remark Input (Only show if not complete for today) */}
          {(!todayRecord || !todayRecord.checkOut) && (
            <View style={styles.remarkContainer}>
              <Text style={styles.remarkLabel}>Remark/Note (Optional)</Text>
              <TextInput
                style={styles.remarkInput}
                placeholder={
                  !todayRecord
                    ? 'e.g., Working from Head Office'
                    : 'e.g., Completed regular shift tasks'
                }
                value={remark}
                onChangeText={setRemark}
                maxLength={100}
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
          )}

          {/* Today's log history */}
          {todayRecord && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Logs</Text>
              <View style={styles.timeline}>
                {/* Check In Log */}
                {todayRecord.checkIn && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: Colors.success }]} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineAction}>Checked In</Text>
                        <Text style={styles.timelineTime}>{formatTime(todayRecord.checkIn.timestamp)}</Text>
                      </View>
                      {todayRecord.checkIn.location && (
                        <Text style={styles.timelineLoc}>{todayRecord.checkIn.location.address}</Text>
                      )}
                      {!!todayRecord.checkIn.remark && (
                        <Text style={styles.timelineRemark}>"{todayRecord.checkIn.remark}"</Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Check Out Log */}
                {todayRecord.checkOut && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: Colors.error }]} />
                    <View style={[styles.timelineContent, { borderLeftWidth: 0 }]}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineAction}>Checked Out</Text>
                        <Text style={styles.timelineTime}>{formatTime(todayRecord.checkOut.timestamp)}</Text>
                      </View>
                      {todayRecord.checkOut.location && (
                        <Text style={styles.timelineLoc}>{todayRecord.checkOut.location.address}</Text>
                      )}
                      {!!todayRecord.checkOut.remark && (
                        <Text style={styles.timelineRemark}>"{todayRecord.checkOut.remark}"</Text>
                      )}
                      <View style={styles.totalHoursBadge}>
                        <Text style={styles.totalHoursText}>
                          Total Hours logged: {todayRecord.workingHours} hrs
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Attendance History list */}
          <View style={[styles.section, { marginBottom: Spacing.xl }]}>
            <Text style={styles.sectionTitle}>Recent Logs (This Month)</Text>
            {loadingRecord ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : history.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={32} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>No past logs found for this month</Text>
              </View>
            ) : (
              history.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTopRow}>
                    <Text style={styles.historyDate}>
                      {new Date(item.dateStr).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <View
                      style={[
                        styles.historyStatusBadge,
                        {
                          backgroundColor:
                            item.status === 'late'
                              ? '#FFFBEB'
                              : item.status === 'present'
                              ? '#F0FDF4'
                              : '#FEF2F2',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyStatusText,
                          {
                            color:
                              item.status === 'late'
                                ? Colors.warning
                                : item.status === 'present'
                                ? Colors.success
                                : Colors.error,
                          },
                        ]}
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyDetails}>
                    <View style={styles.historyDetailCol}>
                      <Text style={styles.historyDetailLabel}>IN</Text>
                      <Text style={styles.historyDetailTime}>{formatTime(item.checkIn?.timestamp)}</Text>
                    </View>
                    <View style={styles.historyDetailCol}>
                      <Text style={styles.historyDetailLabel}>OUT</Text>
                      <Text style={styles.historyDetailTime}>
                        {item.checkOut ? formatTime(item.checkOut.timestamp) : '--:--'}
                      </Text>
                    </View>
                    <View style={styles.historyDetailCol}>
                      <Text style={styles.historyDetailLabel}>TOTAL HOURS</Text>
                      <Text style={styles.historyDetailTime}>
                        {item.checkOut ? `${item.workingHours} hrs` : 'In Progress'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.employeeBg },
  container: { padding: 20, paddingBottom: Spacing.xxl },

  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 13, color: Colors.text.secondary, marginTop: 4, fontWeight: '500' },

  clockContainer: {
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  liveClock: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  actionCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 25,
  },
  actionCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionCircleDisabled: {
    opacity: 0.6,
  },
  circleClockIn: {
    backgroundColor: Colors.primary,
  },
  circleClockOut: {
    backgroundColor: Colors.error,
  },
  circleCompleted: {
    backgroundColor: Colors.text.tertiary,
  },
  circleContent: {
    alignItems: 'center',
    gap: 8,
  },
  circleActionText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },

  timerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  timerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },

  locationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    ...Shadow.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconBgSuccess: {
    backgroundColor: Colors.primaryLight,
  },
  locationIconBgError: {
    backgroundColor: '#FEF2F2',
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  locationTextError: {
    color: Colors.error,
  },
  locationTextLoading: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  refreshLocBtn: {
    padding: 8,
    borderRadius: 8,
  },

  remarkContainer: {
    marginBottom: 25,
  },
  remarkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  remarkInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text.primary,
  },

  section: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 15,
  },

  timeline: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
    marginBottom: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
    borderLeftWidth: 1,
    borderColor: Colors.border,
    paddingLeft: 16,
    marginLeft: -17, // offset to align lines properly with dots
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineAction: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  timelineLoc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  timelineRemark: {
    fontSize: 12,
    color: Colors.primary,
    fontStyle: 'italic',
    marginTop: 4,
    fontWeight: '500',
  },
  totalHoursBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  totalHoursText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },

  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    ...Shadow.sm,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 8,
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDetailCol: {
    flex: 1,
  },
  historyDetailLabel: {
    fontSize: 9,
    color: Colors.text.tertiary,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyDetailTime: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
});
