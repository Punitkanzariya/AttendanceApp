import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllAttendance, getLocalDateString } from '@/firebase';
import type { AttendanceRecord } from '@/types';

export default function TeamAttendanceScreen() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date Selector state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Subscribe to all attendance records
  useEffect(() => {
    const unsubscribe = subscribeToAllAttendance((data) => {
      setRecords(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  // Format date to local date string YYYY-MM-DD
  const dateStr = useMemo(() => {
    return getLocalDateString(selectedDate);
  }, [selectedDate]);

  // Navigate dates
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Filter records for the selected date and search query
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesDate = r.dateStr === dateStr;
      const matchesSearch = r.employeeName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesDate && matchesSearch;
    });
  }, [records, dateStr, searchQuery]);

  // Compute daily stats for the selected date
  const stats = useMemo(() => {
    const dayRecords = records.filter((r) => r.dateStr === dateStr);
    const present = dayRecords.filter((r) => r.status === 'present').length;
    const late = dayRecords.filter((r) => r.status === 'late').length;
    const pending = dayRecords.filter((r) => r.verificationStatus === 'pending').length;

    return {
      total: dayRecords.length,
      present,
      late,
      pending,
    };
  }, [records, dateStr]);

  // Helpers
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return { color: Colors.success, text: 'Verified', bg: '#F0FDF4' };
      case 'rejected':
        return { color: Colors.error, text: 'Rejected', bg: '#FEF2F2' };
      default:
        return { color: Colors.warning, text: 'Pending', bg: '#FFFBEB' };
    }
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const badge = getVerificationBadge(item.verificationStatus);
    const isLate = item.status === 'late';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.empName}>{item.employeeName}</Text>
            <View style={styles.roleContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: isLate ? Colors.warning : Colors.success }]} />
              <Text style={styles.statusLabel}>{isLate ? 'Late Clock-in' : 'On Time'}</Text>
            </View>
          </View>
          <View style={[styles.verificationBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.verificationText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>IN</Text>
            <Text style={styles.infoValue}>{formatTime(item.checkIn?.timestamp)}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>OUT</Text>
            <Text style={styles.infoValue}>
              {item.checkOut ? formatTime(item.checkOut.timestamp) : '--:--'}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>HOURS</Text>
            <Text style={styles.infoValue}>
              {item.checkOut ? `${item.workingHours} hrs` : 'Active'}
            </Text>
          </View>
        </View>

        {/* Location Tags */}
        <View style={styles.locationDetails}>
          {item.checkIn?.location && (
            <Text style={styles.locationText} numberOfLines={1}>
              <Ionicons name="enter-outline" size={12} color={Colors.text.tertiary} />{' '}
              {item.checkIn.location.address}
            </Text>
          )}
          {item.checkOut?.location && (
            <Text style={styles.locationText} numberOfLines={1}>
              <Ionicons name="exit-outline" size={12} color={Colors.text.tertiary} />{' '}
              {item.checkOut.location.address}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Attendance</Text>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDate(-1)}>
          <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.dateLabelContainer}>
          <Ionicons name="calendar-outline" size={16} color={Colors.secondary} />
          <Text style={styles.dateLabel}>
            {selectedDate.toLocaleDateString([], {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDate(1)}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Stat Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: Colors.secondary }]}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Active</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: Colors.success }]}>
          <Text style={styles.statNum}>{stats.present}</Text>
          <Text style={styles.statLabel}>On Time</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: Colors.warning }]}>
          <Text style={styles.statNum}>{stats.late}</Text>
          <Text style={styles.statLabel}>Late In</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search team member..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.text.tertiary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No records logged on this date</Text>
            </View>
          }
        />
      )}
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

  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  arrowBtn: {
    padding: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  dateLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  statNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: FontSize.xs - 1,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    padding: 0,
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
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  verificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  verificationText: {
    fontSize: FontSize.xs - 2,
    fontWeight: '700',
  },

  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoBox: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 9,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  locationDetails: {
    gap: 4,
  },
  locationText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
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
