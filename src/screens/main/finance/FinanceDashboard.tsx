import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientHeader from '@/components/shared/GradientHeader';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { FinanceTabParamList, ExpenseRequest } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllExpenses } from '@/firebase';

export default function FinanceDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<BottomTabNavigationProp<FinanceTabParamList>>();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // States
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);

  // Subscriptions
  useEffect(() => {
    // Subscribe to all expenses for summary stats
    const unsubExpenses = subscribeToAllExpenses([], (data: ExpenseRequest[]) => {
      setExpenses(data);
      setIsLoading(false);
    });

    return () => {
      unsubExpenses();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  // Compute stats and quick feed
  const stats = useMemo(() => {
    const pendingFinance = expenses.filter((e) => e.status === 'pending_finance');
    const reimbursed = expenses.filter((e) => e.status === 'reimbursed');

    const pendingCount = pendingFinance.length;
    const pendingAmount = pendingFinance.reduce((sum, e) => sum + (e.amount || 0), 0);
    const reimbursedAmount = reimbursed.reduce((sum, e) => sum + (e.amount || 0), 0);

    const feedPreview = pendingFinance.slice(0, 3);

    return {
      pendingCount,
      pendingAmount,
      reimbursedAmount,
      feedPreview,
    };
  }, [expenses]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <GradientHeader />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.secondary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.warning]} />
            }
          >
            {/* Welcome Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.name}>{user?.displayName ?? 'Finance Team'}</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.bellBtn}
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate("Notifications")}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={Colors.text.primary}
                  />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
                <View style={styles.avatarWrap}>
                  {user?.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {user?.displayName
                        ? user.displayName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()
                        : "FI"}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Stats Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Financial Summary</Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time" size={18} color="#D97706" />
                </View>
                <Text style={styles.statNum}>{stats.pendingCount}</Text>
                <Text style={styles.statLabel}>Pending Actions</Text>
                <Text style={[styles.statSubText, { color: Colors.warning }]}>₹{stats.pendingAmount} to process</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={18} color="#16A34A" />
                </View>
                <Text style={[styles.statNum, { color: Colors.success, fontSize: 18 }]} numberOfLines={1}>₹{stats.reimbursedAmount}</Text>
                <Text style={styles.statLabel}>Total Reimbursed</Text>
                <Text style={styles.statSubText}>Lifetime</Text>
              </View>
            </View>

            {/* Quick Actions Shortcuts */}
            <Text style={styles.sectionTitle}>Quick Shortcuts</Text>
            <View style={styles.shortcutsGrid}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Expenses')}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="receipt" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.shortcutTxt}>Expenses</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Reimbursements')}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="cash" size={24} color="#059669" />
                </View>
                <Text style={styles.shortcutTxt}>Reimburse</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Reports')}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="bar-chart" size={24} color="#9333EA" />
                </View>
                <Text style={styles.shortcutTxt}>Reports</Text>
              </TouchableOpacity>
            </View>

            {/* Pending Feed */}
            <View style={styles.sectionHeaderList}>
              <Text style={styles.sectionTitleList}>Pending Reimbursements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Expenses')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {stats.feedPreview.length === 0 ? (
              <View style={styles.emptyFeed}>
                <Ionicons name="checkmark-done-circle-outline" size={40} color={Colors.text.tertiary} />
                <Text style={styles.emptyFeedTxt}>All caught up!</Text>
              </View>
            ) : (
              stats.feedPreview.map((item) => (
                <View key={item.id} style={styles.feedCard}>
                  <View style={styles.feedTopRow}>
                    <View style={styles.feedIconWrap}>
                      <Ionicons name="receipt" size={18} color={Colors.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedName}>{item.employeeName}</Text>
                      <Text style={styles.feedTitle}>{item.category}</Text>
                    </View>
                    <Text style={styles.feedAmount}>₹{item.amount}</Text>
                  </View>
                  <Text style={styles.feedSubtitle}>{item.description}</Text>
                  <View style={styles.feedActions}>
                    <TouchableOpacity
                      style={styles.feedActionBtn}
                      onPress={() => navigation.navigate('Expenses')}
                    >
                      <Text style={styles.feedActionTxt}>Review</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#BFDBFE" },
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  greeting: { fontSize: FontSize.md, color: Colors.text.secondary },
  name: { fontSize: 22, fontWeight: FontWeight.bold, color: Colors.text.primary, marginTop: 4 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadow.sm,
  },
  avatarInitials: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginLeft: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  
  sectionHeaderList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitleList: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  dateText: { fontSize: FontSize.sm, color: Colors.text.secondary },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },

  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadow.sm,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  statNum: { fontSize: 24, fontWeight: FontWeight.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4 },
  statSubText: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: 4, fontWeight: '500' },

  shortcutsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    ...Shadow.sm,
  },
  shortcutIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  shortcutTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.primary },

  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyFeedTxt: { marginTop: Spacing.sm, color: Colors.text.tertiary, fontSize: FontSize.md },

  feedCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadow.sm,
  },
  feedTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  feedIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  feedName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary },
  feedTitle: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2 },
  feedAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  feedSubtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginVertical: Spacing.sm },
  
  feedActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  feedActionBtn: { flex: 1, backgroundColor: '#FEF3C7', paddingVertical: 8, borderRadius: BorderRadius.md, alignItems: 'center' },
  feedActionTxt: { color: '#D97706', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
