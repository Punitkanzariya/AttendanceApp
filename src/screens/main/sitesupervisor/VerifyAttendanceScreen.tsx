import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllAttendance, updateVerificationStatus } from '@/firebase';
import type { AttendanceRecord } from '@/types';
import AttendanceDetailModal from '@/components/shared/AttendanceDetailModal';

export default function VerifyAttendanceScreen() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailVisible, setDetailVisible] = useState(false);

  // Subscribe to all attendance
  useEffect(() => {
    const unsubscribe = subscribeToAllAttendance((data) => {
      setRecords(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-switch filter to 'all' if no pending records are found on initial load
  useEffect(() => {
    if (!isLoading && !hasAutoSwitched) {
      const pendingCount = records.filter(r => r.verificationStatus === 'pending').length;
      if (pendingCount === 0) {
        setFilter('all');
      }
      setHasAutoSwitched(true);
    }
  }, [records, isLoading, hasAutoSwitched]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Simulating refresh since Firebase is real-time
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  // Filter records based on selected tab
  const filteredRecords = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter((r) => r.verificationStatus === filter);
  }, [records, filter]);

  const handleVerify = async (id: string) => {
    if (!user?.uid) return;
    setProcessingId(id);
    try {
      await updateVerificationStatus(id, 'verified', user.uid);
      Alert.alert('Verified', 'Employee attendance verified successfully!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to verify attendance.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!user?.uid) return;
    
    Alert.alert(
      'Reject Attendance',
      'Are you sure you want to reject this attendance record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(id);
            try {
              await updateVerificationStatus(id, 'rejected', user.uid);
              Alert.alert('Rejected', 'Employee attendance marked as rejected.');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', 'Failed to reject attendance.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Helper formats
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'verified':
        return { bg: '#F0FDF4', border: '#DCFCE7', color: Colors.success, text: 'VERIFIED' };
      case 'rejected':
        return { bg: '#FEF2F2', border: '#FEE2E2', color: Colors.error, text: 'REJECTED' };
      default:
        return { bg: '#FFFBEB', border: '#FEF3C7', color: Colors.warning, text: 'PENDING' };
    }
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const badge = getStatusBadgeStyles(item.verificationStatus);
    const isLate = item.status === 'late';
    const isPending = item.verificationStatus === 'pending';
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setSelectedRecord(item);
            setDetailVisible(true);
          }}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.employeeName}</Text>
            <Text style={styles.logDate}>
              {new Date(item.dateStr).toLocaleDateString([], {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        {/* Timestamps Row */}
        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <View style={styles.labelRow}>
              <Ionicons name="enter-outline" size={14} color={Colors.success} />
              <Text style={styles.timeLabel}>CLOCKED IN</Text>
            </View>
            <Text style={styles.timeValue}>{formatTime(item.checkIn?.timestamp)}</Text>
            {isLate && (
              <View style={styles.lateTag}>
                <Text style={styles.lateTagText}>LATE</Text>
              </View>
            )}
          </View>

          <View style={styles.timeCol}>
            <View style={styles.labelRow}>
              <Ionicons name="exit-outline" size={14} color={Colors.error} />
              <Text style={styles.timeLabel}>CLOCKED OUT</Text>
            </View>
            <Text style={styles.timeValue}>
              {item.checkOut ? formatTime(item.checkOut.timestamp) : '--:--'}
            </Text>
          </View>

          <View style={styles.timeCol}>
            <View style={styles.labelRow}>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              <Text style={styles.timeLabel}>TOTAL HOURS</Text>
            </View>
            <Text style={styles.timeValue}>
              {item.checkOut ? `${item.workingHours} hrs` : 'Active'}
            </Text>
          </View>
        </View>

        {/* Locations */}
        <View style={styles.locContainer}>
          {item.checkIn?.location && (
            <View style={styles.locItem}>
              <Ionicons name="location-outline" size={14} color={Colors.text.tertiary} style={{ marginTop: 1 }} />
              <Text style={styles.locText} numberOfLines={2}>
                In: {item.checkIn.location.address}
              </Text>
            </View>
          )}
          {item.checkOut?.location && (
            <View style={styles.locItem}>
              <Ionicons name="location-outline" size={14} color={Colors.text.tertiary} style={{ marginTop: 1 }} />
              <Text style={styles.locText} numberOfLines={2}>
                Out: {item.checkOut.location.address}
              </Text>
            </View>
          )}
        </View>

        {/* Remarks */}
        {(item.checkIn?.remark || item.checkOut?.remark) && (
          <View style={styles.remarkContainer}>
            {!!item.checkIn?.remark && (
              <Text style={styles.remarkText} numberOfLines={1}>
                <Text style={styles.remarkLabel}>In Note: </Text>"{item.checkIn.remark}"
              </Text>
            )}
            {!!item.checkOut?.remark && (
              <Text style={styles.remarkText} numberOfLines={1}>
                <Text style={styles.remarkLabel}>Out Note: </Text>"{item.checkOut.remark}"
              </Text>
            )}
          </View>
        )}
        </TouchableOpacity>

        {/* Actions (Only show for pending logs) */}
        {isPending && (
          <View style={styles.actionRow}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: Spacing.xs }} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.btnIconWrap}>
                    <Ionicons
                      name="close-circle-outline"
                      size={16}
                      color={Colors.error}
                      style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                    />
                  </View>
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.verifyBtn]}
                  onPress={() => handleVerify(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.btnIconWrap}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={Colors.white}
                      style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                    />
                  </View>
                  <Text style={styles.verifyBtnText}>Verify</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Verify Attendance</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['pending', 'verified', 'rejected', 'all'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No attendance records found</Text>
            </View>
          }
        />
      )}

      <AttendanceDetailModal
        visible={isDetailVisible}
        onClose={() => setDetailVisible(false)}
        record={selectedRecord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  header: {
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    lineHeight: 34,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: Colors.text.secondary,
  },
  filterTextActive: {
    color: Colors.white,
  },

  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  empName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  logDate: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FontSize.xs - 2,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  timeCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: FontSize.xs - 2,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.bold,
  },
  timeValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  lateTag: {
    backgroundColor: '#FFFBEB',
    borderWidth: 0.5,
    borderColor: Colors.warning + '40',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  lateTagText: {
    fontSize: 9,
    color: Colors.warning,
    fontWeight: '800',
  },

  locContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 6,
    marginBottom: Spacing.md,
  },
  locItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locText: {
    fontSize: FontSize.sm - 2,
    color: Colors.text.secondary,
    flex: 1,
  },

  remarkContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  remarkText: {
    fontSize: FontSize.sm - 2,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  remarkLabel: {
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
    fontStyle: 'normal',
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  rejectBtn: {
    borderColor: Colors.error + '40',
    backgroundColor: '#FEF2F2',
  },
  rejectBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.error,
  },
  verifyBtn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  verifyBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  btnIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
});
