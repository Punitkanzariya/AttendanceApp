import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllEmployees, updateEmployeeProfile, createEmployeeByAdmin } from '@/firebase';
import type { User, UserRole } from '@/types';
import EmployeeEditModal from '@/screens/admin/components/EmployeeEditModal';
import EmployeeAddModal from '@/screens/admin/components/EmployeeAddModal';

export default function AdminEmployeesScreen() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');
  
  // Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAllEmployees((data) => {
      setEmployees(data);
      setIsLoading(false);
      setIsRefreshing(false);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    // In a real-time list, manual refresh is mostly visual feedback
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSaveUser = async (uid: string, updates: Partial<User>) => {
    await updateEmployeeProfile(uid, updates);
    // Realtime listener will automatically update the list
  };

  const handleAddUser = async (params: { fullName: string; email: string; phone: string; role: UserRole; password?: string }) => {
    await createEmployeeByAdmin(params);
    // Realtime listener will automatically pick up the new user
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (filter === 'pending') return !emp.isActive;
      if (filter === 'active') return emp.isActive;
      return true;
    });
  }, [employees, filter]);

  const renderItem = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => setSelectedUser(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{item.displayName?.charAt(0) || '?'}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.displayName || 'Unnamed User'}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[styles.badgeTxt, { color: Colors.primary }]}>{item.role.replace('_', ' ')}</Text>
            </View>
            {item.isActive ? (
              <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.badgeTxt, { color: Colors.success }]}>Active</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.badgeTxt, { color: '#D97706' }]}>Pending Approval</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  ), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Employees</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
          <Ionicons name="person-add" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTxt, filter === 'all' && styles.filterTxtActive]}>All Users</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterTxt, filter === 'pending' && styles.filterTxtActive]}>Pending</Text>
          {employees.filter(e => !e.isActive).length > 0 && (
            <View style={styles.notificationDot} />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterTxt, filter === 'active' && styles.filterTxtActive]}>Active</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={item => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTxt}>No employees found</Text>
            </View>
          }
        />
      )}

      {/* Edit Modal */}
      <EmployeeEditModal 
        visible={!!selectedUser}
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSave={handleSaveUser}
      />

      {/* Add Modal */}
      <EmployeeAddModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAdd={handleAddUser}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTxt: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  filterTxtActive: {
    color: Colors.white,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    marginLeft: 6,
    marginTop: 2,
  },
  list: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarTxt: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyTxt: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text.tertiary,
  },
});
