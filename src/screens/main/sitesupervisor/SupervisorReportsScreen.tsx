import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import {
  subscribeToAllEmployees,
  subscribeToAllAttendance,
  subscribeToAllExpenses,
} from '@/firebase';
import type { User, AttendanceRecord, ExpenseRequest } from '@/types';
import { exportToCSV, exportToPDF, generateAttendanceHTML, generateExpensesHTML } from '@/utils/exportHelper';

type ReportTab = 'attendance' | 'expenses';

export default function SupervisorReportsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Raw Database States
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);

  // Subscriptions
  useEffect(() => {
    // 1. Subscribe to Employees
    const unsubEmployees = subscribeToAllEmployees((data) => {
      setEmployees(data);
    });

    // 2. Subscribe to Attendance
    const unsubAttendance = subscribeToAllAttendance((data) => {
      setAttendance(data);
    });

    // 3. Subscribe to Expenses
    const unsubExpenses = subscribeToAllExpenses([], (data) => {
      setExpenses(data);
      setIsLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubExpenses();
    };
  }, []);

  // Filter employees belonging to this supervisor's site
  const siteEmployees = useMemo(() => {
    if (!user?.siteId) {
      // Fallback: If supervisor has no siteId assigned, show employees in list for demo
      return employees.filter(emp => emp.role === 'employee');
    }
    return employees.filter(emp => emp.siteId === user.siteId && emp.role === 'employee');
  }, [employees, user?.siteId]);

  const siteEmployeeIds = useMemo(() => {
    return siteEmployees.map(emp => emp.uid);
  }, [siteEmployees]);

  // Filter logs for this site's employees
  const siteAttendance = useMemo(() => {
    return attendance.filter(log => siteEmployeeIds.includes(log.employeeId));
  }, [attendance, siteEmployeeIds]);

  const siteExpenses = useMemo(() => {
    return expenses.filter(exp => siteEmployeeIds.includes(exp.employeeId));
  }, [expenses, siteEmployeeIds]);

  // ─── Attendance Calculations ───────────────────────────────────────────────
  const attendanceStats = useMemo(() => {
    const totalLogs = siteAttendance.length;
    const presentLogs = siteAttendance.filter(log => log.status === 'present').length;
    const lateLogs = siteAttendance.filter(log => log.status === 'late').length;
    const verifiedLogs = siteAttendance.filter(log => log.verificationStatus === 'verified').length;

    // Calculate present rate
    const totalWorkingDaysEstimate = siteEmployees.length * 20; // estimate 20 working days per employee
    const totalPresents = presentLogs + lateLogs;
    const attendancePercentage = totalWorkingDaysEstimate > 0 
      ? Math.min(100, Math.round((totalPresents / totalWorkingDaysEstimate) * 100))
      : 0;

    // Compile stats per employee
    const employeeSummaries = siteEmployees.map(emp => {
      const empLogs = siteAttendance.filter(log => log.employeeId === emp.uid);
      const presents = empLogs.filter(log => log.status === 'present').length;
      const lates = empLogs.filter(log => log.status === 'late').length;
      const absents = empLogs.filter(log => log.status === 'absent').length; // explicit absents if any
      const totalHours = empLogs.reduce((acc, log) => acc + (log.workingHours || 0), 0);
      const avgHours = empLogs.length > 0 ? parseFloat((totalHours / empLogs.length).toFixed(1)) : 0;

      return {
        uid: emp.uid,
        name: emp.displayName || 'Unknown Employee',
        presentCount: presents,
        lateCount: lates,
        absentCount: absents,
        totalHours,
        avgHours,
      };
    });

    return {
      presentLogs,
      lateLogs,
      verifiedLogs,
      attendancePercentage,
      employeeSummaries,
    };
  }, [siteAttendance, siteEmployees]);

  // ─── Expense Calculations ──────────────────────────────────────────────────
  const expenseStats = useMemo(() => {
    // Total approved or reimbursed expenses by site employees
    const approvedExpenses = siteExpenses.filter(e => 
      e.status === 'pending_manager' || 
      e.status === 'pending_finance' || 
      e.status === 'reimbursed'
    );
    const totalSpent = approvedExpenses.reduce((acc, exp) => acc + exp.amount, 0);

    // Group by category
    const categories: Record<string, number> = { Travel: 0, Meals: 0, Fuel: 0, Supplies: 0, Other: 0 };
    approvedExpenses.forEach(exp => {
      const cat = exp.category || 'Other';
      if (categories[cat] !== undefined) {
        categories[cat] += exp.amount;
      } else {
        categories['Other'] += exp.amount;
      }
    });

    const categoryDistribution = Object.keys(categories).map(key => ({
      category: key,
      amount: categories[key],
      percentage: totalSpent > 0 ? Math.round((categories[key] / totalSpent) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return {
      totalSpent,
      categoryDistribution,
      totalRequests: siteExpenses.length,
      pendingApproval: siteExpenses.filter(e => e.status === 'pending_supervisor').length,
    };
  }, [siteExpenses]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'attendance') {
        const records = siteAttendance.map(log => {
          const emp = employees.find(e => e.uid === log.employeeId);
          let checkInStr = 'N/A';
          if (log.checkIn && log.checkIn.timestamp) {
            try {
              checkInStr = new Date(log.checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }
          let checkOutStr = 'N/A';
          if (log.checkOut && log.checkOut.timestamp) {
            try {
              checkOutStr = new Date(log.checkOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }
          let hoursStr = '0 hrs';
          if (log.workingHours !== undefined && log.workingHours !== null) {
            hoursStr = `${log.workingHours.toFixed(1)} hrs`;
          }
          let statusText = 'Present';
          if (log.status) {
            statusText = log.status.charAt(0).toUpperCase() + log.status.slice(1);
          }
          let verificationText = 'Pending';
          if (log.verificationStatus) {
            verificationText = log.verificationStatus.charAt(0).toUpperCase() + log.verificationStatus.slice(1);
          }

          return {
            name: emp?.displayName || log.employeeName || 'Unknown Employee',
            date: log.dateStr || 'N/A',
            checkIn: checkInStr,
            checkOut: checkOutStr,
            hours: hoursStr,
            status: statusText,
            verification: verificationText,
          };
        });
        const html = generateAttendanceHTML(
          'Site Attendance Report',
          `Site: ${user?.siteId ? `Zone ID ${user.siteId}` : 'All Assigned Zones'}`,
          records
        );
        await exportToPDF(html, `Attendance_Report_${user?.siteId || 'All'}`);
      } else {
        const records = siteExpenses.map(exp => {
          const emp = employees.find(e => e.uid === exp.employeeId);
          let statusText: string = exp.status || 'pending_supervisor';
          if (statusText === 'pending_supervisor') statusText = 'Pending Supervisor';
          else if (statusText === 'pending_manager') statusText = 'Pending Manager';
          else if (statusText === 'pending_finance') statusText = 'Pending Finance';
          else if (statusText === 'reimbursed') statusText = 'Reimbursed';
          else if (statusText === 'rejected') statusText = 'Rejected';
          else if (statusText) statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);

          return {
            name: emp?.displayName || exp.employeeName || 'Unknown Employee',
            category: exp.category || 'Other',
            date: exp.date || 'N/A',
            amount: exp.amount ? exp.amount.toString() : '0',
            description: exp.description || '',
            status: statusText,
          };
        });
        const html = generateExpensesHTML(
          'Site Expense Report',
          `Site: ${user?.siteId ? `Zone ID ${user.siteId}` : 'All Assigned Zones'}`,
          records
        );
        await exportToPDF(html, `Expense_Report_${user?.siteId || 'All'}`);
      }
      Alert.alert('Success', 'PDF Report generated successfully');
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'An error occurred during PDF generation');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'attendance') {
        const headers = ['Employee Name', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'Status', 'Verification'];
        const rows = siteAttendance.map(log => {
          const emp = employees.find(e => e.uid === log.employeeId);
          let checkInStr = 'N/A';
          if (log.checkIn && log.checkIn.timestamp) {
            try {
              checkInStr = new Date(log.checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }
          let checkOutStr = 'N/A';
          if (log.checkOut && log.checkOut.timestamp) {
            try {
              checkOutStr = new Date(log.checkOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
          }
          let hoursVal = '0';
          if (log.workingHours !== undefined && log.workingHours !== null) {
            hoursVal = log.workingHours.toFixed(1);
          }
          let statusText = 'Present';
          if (log.status) {
            statusText = log.status.charAt(0).toUpperCase() + log.status.slice(1);
          }
          let verificationText = 'Pending';
          if (log.verificationStatus) {
            verificationText = log.verificationStatus.charAt(0).toUpperCase() + log.verificationStatus.slice(1);
          }

          return [
            emp?.displayName || log.employeeName || 'Unknown Employee',
            log.dateStr || 'N/A',
            checkInStr,
            checkOutStr,
            hoursVal,
            statusText,
            verificationText,
          ];
        });
        await exportToCSV(headers, rows, `Attendance_Report_${user?.siteId || 'All'}`);
      } else {
        const headers = ['Employee Name', 'Category', 'Date', 'Amount (INR)', 'Description', 'Status'];
        const rows = siteExpenses.map(exp => {
          const emp = employees.find(e => e.uid === exp.employeeId);
          let statusText: string = exp.status || 'pending_supervisor';
          if (statusText === 'pending_supervisor') statusText = 'Pending Supervisor';
          else if (statusText === 'pending_manager') statusText = 'Pending Manager';
          else if (statusText === 'pending_finance') statusText = 'Pending Finance';
          else if (statusText === 'reimbursed') statusText = 'Reimbursed';
          else if (statusText === 'rejected') statusText = 'Rejected';
          else if (statusText) statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);

          return [
            emp?.displayName || exp.employeeName || 'Unknown Employee',
            exp.category || 'Other',
            exp.date || 'N/A',
            exp.amount ? exp.amount.toString() : '0',
            exp.description || '',
            statusText,
          ];
        });
        await exportToCSV(headers, rows, `Expense_Report_${user?.siteId || 'All'}`);
      }
      Alert.alert('Success', 'CSV Report generated successfully');
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'An error occurred during CSV generation');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Site Reports</Text>
        <Text style={styles.headerSubtitle}>
          Site: {user?.siteId ? `Zone ID ${user.siteId}` : 'All Assigned Zones'}
        </Text>
      </View>

      {/* Reports Tab Selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'attendance' ? Colors.white : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
            Attendance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
          onPress={() => setActiveTab('expenses')}
        >
          <Ionicons
            name="wallet-outline"
            size={18}
            color={activeTab === 'expenses' ? Colors.white : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            Expenses
          </Text>
        </TouchableOpacity>
      </View>

      {/* Export Action Buttons */}
      <View style={styles.exportContainer}>
        <TouchableOpacity
          style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
          onPress={handleExportPDF}
          disabled={isExporting}
        >
          <Ionicons name="document-text-outline" size={16} color={Colors.white} />
          <Text style={styles.exportBtnText}>Export PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, styles.exportBtnExcel, isExporting && styles.exportBtnDisabled]}
          onPress={handleExportExcel}
          disabled={isExporting}
        >
          <Ionicons name="grid-outline" size={16} color={Colors.white} />
          <Text style={styles.exportBtnText}>Export Excel</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {activeTab === 'attendance' ? (
            /* ATTENDANCE REPORT PANEL */
            <View>
              {/* Stat Card */}
              <View style={styles.mainCard}>
                <View style={styles.mainCardHeader}>
                  <Text style={styles.cardTitle}>Monthly Attendance Overview</Text>
                  <Text style={styles.percentageText}>{attendanceStats.attendancePercentage}%</Text>
                </View>
                <Text style={styles.cardDesc}>Est. Present Rate of site workforce</Text>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{attendanceStats.presentLogs}</Text>
                    <Text style={styles.metricLabel}>On-Time</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.warning }]}>
                      {attendanceStats.lateLogs}
                    </Text>
                    <Text style={styles.metricLabel}>Late In</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.accent }]}>
                      {attendanceStats.verifiedLogs}
                    </Text>
                    <Text style={styles.metricLabel}>Verified Logs</Text>
                  </View>
                </View>
              </View>

              {/* Employee Breakdown List */}
              <Text style={styles.sectionTitle}>Employee Attendance Summaries</Text>
              {attendanceStats.employeeSummaries.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No site employees registered</Text>
                </View>
              ) : (
                attendanceStats.employeeSummaries.map((summary) => (
                  <View key={summary.uid} style={styles.empRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTxt}>
                        {summary.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{summary.name}</Text>
                      <Text style={styles.empStatsText}>
                        Avg Hours: {summary.avgHours} hrs/day
                      </Text>
                    </View>
                    <View style={styles.statsBadgeColumn}>
                      <View style={[styles.badge, styles.badgeSuccess]}>
                        <Text style={styles.badgeSuccessText}>{summary.presentCount} present</Text>
                      </View>
                      {summary.lateCount > 0 && (
                        <View style={[styles.badge, styles.badgeWarning, { marginTop: 4 }]}>
                          <Text style={styles.badgeWarningText}>{summary.lateCount} late</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : (
            /* EXPENSES REPORT PANEL */
            <View>
              {/* Expense Stat Card */}
              <View style={[styles.mainCard, { borderTopColor: Colors.error, borderTopWidth: 4 }]}>
                <Text style={styles.cardTitle}>Total Site Spend (Approved)</Text>
                <Text style={styles.totalAmount}>₹{expenseStats.totalSpent.toLocaleString('en-IN')}</Text>
                <Text style={styles.cardDesc}>Sum total of verified receipts</Text>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{expenseStats.totalRequests}</Text>
                    <Text style={styles.metricLabel}>Total Requests</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.warning }]}>
                      {expenseStats.pendingApproval}
                    </Text>
                    <Text style={styles.metricLabel}>Awaiting Verify</Text>
                  </View>
                </View>
              </View>

              {/* Expense Distribution */}
              <Text style={styles.sectionTitle}>Category-wise Spend</Text>
              {expenseStats.categoryDistribution.length === 0 || expenseStats.totalSpent === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No approved expenses logged for this site</Text>
                </View>
              ) : (
                <View style={styles.distributionContainer}>
                  {expenseStats.categoryDistribution.map((item) => (
                    <View key={item.category} style={styles.distRow}>
                      <View style={styles.distMeta}>
                        <Text style={styles.distName}>{item.category}</Text>
                        <Text style={styles.distAmount}>
                          ₹{item.amount.toLocaleString('en-IN')} ({item.percentage}%)
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${item.percentage}%`, backgroundColor: Colors.accent },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    gap: 8,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeight.semibold,
  },
  tabTextActive: {
    color: Colors.white,
  },

  mainCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 30,
    ...Shadow.md,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  percentageText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  cardDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 4,
    fontWeight: FontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  metricLabel: {
    fontSize: FontSize.xs - 2,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },

  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    ...Shadow.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  empName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  empStatsText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  statsBadgeColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  badgeSuccess: {
    backgroundColor: '#F0FDF4',
  },
  badgeSuccessText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.success,
  },
  badgeWarning: {
    backgroundColor: '#FFFBEB',
  },
  badgeWarningText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.warning,
  },

  /* Expenses Reports Specific Styles */
  totalAmount: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginTop: 10,
  },
  distributionContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  distRow: {
    marginBottom: 16,
  },
  distMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  distName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  distAmount: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: FontWeight.semibold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  exportContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F766E', // teal-700
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 8,
    ...Shadow.sm,
  },
  exportBtnExcel: {
    backgroundColor: '#15803D', // green-700
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
  },
});
