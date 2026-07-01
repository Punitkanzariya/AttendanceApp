import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientHeader from '@/components/shared/GradientHeader';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AdminTabParamList, User, Project } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllEmployees } from '@/firebase/adminService';
import { subscribeToAllProjects } from '@/firebase/projectService';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // States
  const [employees, setEmployees] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Subscriptions
  useEffect(() => {
    let empLoaded = false;
    let projLoaded = false;

    const checkLoading = () => {
      if (empLoaded && projLoaded) {
        setIsLoading(false);
      }
    };

    const unsubEmp = subscribeToAllEmployees((data) => {
      setEmployees(data);
      empLoaded = true;
      checkLoading();
    });

    const unsubProj = subscribeToAllProjects((data) => {
      setProjects(data);
      projLoaded = true;
      checkLoading();
    });

    return () => {
      unsubEmp();
      unsubProj();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  }, []);

  // Compute stats
  const stats = React.useMemo(() => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.isActive !== false).length;
    
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => !p.isClosed).length;

    return {
      totalEmployees,
      activeEmployees,
      totalProjects,
      activeProjects,
    };
  }, [employees, projects]);

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
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.secondary]} />
            }
          >
            {/* Welcome Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>Administrator Dashboard,</Text>
                <Text style={styles.name}>{user?.displayName ?? 'Admin'}</Text>
              </View>
              <View style={styles.headerRight}>
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
                        : "AD"}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Stats Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>System Overview</Text>
              <Text style={styles.dateText}>
                {formatDateDDMMYYYY(new Date())}
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="people" size={18} color="#0284C7" />
                </View>
                <Text style={styles.statNum}>{stats.totalEmployees}</Text>
                <Text style={styles.statLabel}>Total Employees</Text>
                {stats.totalEmployees !== stats.activeEmployees && (
                  <Text style={styles.statSubText}>{stats.activeEmployees} Active</Text>
                )}
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="business" size={18} color="#9333EA" />
                </View>
                <Text style={styles.statNum}>{stats.activeProjects}</Text>
                <Text style={styles.statLabel}>Active Projects</Text>
                {stats.totalProjects !== stats.activeProjects && (
                   <Text style={[styles.statSubText, { color: Colors.text.tertiary }]}>{stats.totalProjects} Total</Text>
                )}
              </View>
            </View>

            {/* Quick Actions Shortcuts */}
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.shortcutsGrid}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Employees')}
                activeOpacity={0.8}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="people-outline" size={24} color="#D97706" />
                </View>
                <Text style={styles.shortcutLabel}>Manage Employees</Text>
                <Text style={styles.shortcutDesc}>Add, edit, or remove users</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Projects')}
                activeOpacity={0.8}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="business-outline" size={24} color="#16A34A" />
                </View>
                <Text style={styles.shortcutLabel}>Manage Projects</Text>
                <Text style={styles.shortcutDesc}>Create or edit projects</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shortcutsGrid}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Roles')}
                activeOpacity={0.8}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#DC2626" />
                </View>
                <Text style={styles.shortcutLabel}>Role Permissions</Text>
                <Text style={styles.shortcutDesc}>Configure system access</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => navigation.navigate('Reports')}
                activeOpacity={0.8}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="bar-chart-outline" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.shortcutLabel}>Generate Reports</Text>
                <Text style={styles.shortcutDesc}>Export system data</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1E293B" },
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: { fontSize: 14, color: Colors.text.secondary, fontWeight: FontWeight.medium },
  name: { fontSize: 22, fontWeight: FontWeight.bold, color: Colors.text.primary, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: Colors.white, fontSize: 12, fontWeight: "700" },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: 15 },
  dateText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: FontWeight.semibold },

  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 30 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNum: { fontSize: FontSize.xxl + 4, fontWeight: FontWeight.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, fontWeight: FontWeight.semibold, marginTop: 4 },
  statSubText: { fontSize: 10, color: Colors.success, fontWeight: FontWeight.bold, marginTop: 4 },

  shortcutsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Shadow.sm,
  },
  shortcutIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  shortcutLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  shortcutDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});
