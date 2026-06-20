import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface QuickAction { icon: IoniconName; label: string; color: string; bg: string }

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'location',  label: 'Mark Attendance', color: '#2563EB', bg: '#EFF6FF' },
  { icon: 'calendar',  label: 'Apply Leave',     color: '#D97706', bg: '#FFFBEB' },
  { icon: 'receipt',   label: 'Submit Expense',  color: '#059669', bg: '#F0FDF4' },
  { icon: 'bar-chart', label: 'My History',      color: '#7C3AED', bg: '#FDF4FF' },
];

export default function EmployeeDashboard() {
  const { user, logout } = useAuthStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.name}>{user?.displayName ?? 'Employee'}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="person" size={10} color={Colors.primary} />
              <Text style={styles.roleText}>Employee</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Today's attendance card */}
        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <Ionicons name="calendar-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.attendanceTitle}>Today's Attendance</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="log-in-outline" size={20} color={Colors.success} />
              <Text style={styles.statusValue}>--:--</Text>
              <Text style={styles.statusLabel}>Check In</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.statusValue}>--:--</Text>
              <Text style={styles.statusLabel}>Check Out</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Ionicons name="ellipse" size={10} color={Colors.warning} style={{ marginBottom: 2 }} />
              <Text style={[styles.statusValue, { color: Colors.warning, fontSize: FontSize.md }]}>Absent</Text>
              <Text style={styles.statusLabel}>Status</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionCard, { backgroundColor: a.bg }]}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: a.color + '20' }]}>
                <Ionicons name={a.icon} size={26} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={36} color={Colors.text.tertiary} />
          <Text style={styles.emptyText}>No recent activity</Text>
          <Text style={styles.emptySubtext}>Your attendance and expense history will appear here</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  headerLeft: { gap: 4 },
  greeting: { fontSize: FontSize.sm, color: Colors.text.secondary },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  roleText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  logoutText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  attendanceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.xl, ...Shadow.sm,
  },
  attendanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  attendanceTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.secondary },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statusItem: { alignItems: 'center', gap: 4 },
  statusValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary },
  statusLabel: { fontSize: FontSize.xs, color: Colors.text.tertiary },
  statusDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  actionCard: {
    width: '47%', borderRadius: BorderRadius.lg, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  actionIconWrap: {
    width: 52, height: 52, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, textAlign: 'center' },

  emptyCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.secondary },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
});
