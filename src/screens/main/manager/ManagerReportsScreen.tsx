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
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import {
  subscribeToAllEmployees,
  subscribeToAllAttendance,
  subscribeToAllLeaves,
  subscribeToAllExpenses,
} from '@/firebase';
import type { User, AttendanceRecord, LeaveRequest, ExpenseRequest } from '@/types';
import { exportToCSV, exportToPDF, generateAttendanceHTML, generateExpensesHTML, generateLeavesHTML } from '@/utils/exportHelper';
import { formatLeaveDurationText } from '@/utils/dateUtils';

type ManagerReportTab = 'attendance' | 'leaves' | 'expenses';

export default function ManagerReportsScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'expenses'>(
    useAuthStore.getState().user?.role === 'finance' ? 'expenses' : 'attendance'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Database States
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);

  // Subscriptions
  useEffect(() => {
    const unsubEmployees = subscribeToAllEmployees((data: User[]) => {
      setEmployees(data);
    });

    const unsubAttendance = subscribeToAllAttendance((data: AttendanceRecord[]) => {
      setAttendance(data);
    });

    const unsubLeaves = subscribeToAllLeaves((data: LeaveRequest[]) => {
      setLeaves(data);
    });

    const unsubExpenses = subscribeToAllExpenses([], (data: ExpenseRequest[]) => {
      setExpenses(data);
      setIsLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
      unsubExpenses();
    };
  }, []);

  // Filter employees belonging to this manager's team
  const teamEmployees = useMemo(() => {
    // Fallback: If manager has no assigned employee UIDs, show all employees under this manager role for preview
    const managed = employees.filter(emp => emp.managerId === user?.uid && emp.role === 'employee');
    if (managed.length === 0) {
      return employees.filter(emp => emp.role === 'employee');
    }
    return managed;
  }, [employees, user?.uid]);

  const teamEmployeeIds = useMemo(() => {
    return teamEmployees.map(emp => emp.uid);
  }, [teamEmployees]);

  // Filter data for team
  const teamAttendance = useMemo(() => {
    return attendance.filter(log => teamEmployeeIds.includes(log.employeeId));
  }, [attendance, teamEmployeeIds]);

  const teamLeaves = useMemo(() => {
    return leaves.filter(lvl => teamEmployeeIds.includes(lvl.employeeId));
  }, [leaves, teamEmployeeIds]);

  const teamExpenses = useMemo(() => {
    return expenses.filter(exp => teamEmployeeIds.includes(exp.employeeId));
  }, [expenses, teamEmployeeIds]);

  // ─── Attendance Calculations ───────────────────────────────────────────────
  const attendanceStats = useMemo(() => {
    const totalLogs = teamAttendance.length;
    const presentLogs = teamAttendance.filter(log => log.status === 'present').length;
    const lateLogs = teamAttendance.filter(log => log.status === 'late').length;

    const totalWorkingDaysEstimate = teamEmployees.length * 20; // estimate 20 working days/month
    const attendancePercentage = totalWorkingDaysEstimate > 0 
      ? Math.min(100, Math.round(((presentLogs + lateLogs) / totalWorkingDaysEstimate) * 100))
      : 0;

    const employeeSummaries = teamEmployees.map(emp => {
      const empLogs = teamAttendance.filter(log => log.employeeId === emp.uid);
      const presents = empLogs.filter(log => log.status === 'present').length;
      const lates = empLogs.filter(log => log.status === 'late').length;
      const totalHours = empLogs.reduce((acc, log) => acc + (log.workingHours || 0), 0);
      const avgHours = empLogs.length > 0 ? parseFloat((totalHours / empLogs.length).toFixed(1)) : 0;

      return {
        uid: emp.uid,
        name: emp.displayName || 'Unknown Employee',
        presentCount: presents,
        lateCount: lates,
        avgHours,
      };
    });

    return {
      presentLogs,
      lateLogs,
      attendancePercentage,
      employeeSummaries,
    };
  }, [teamAttendance, teamEmployees]);

  // ─── Leave Calculations ───────────────────────────────────────────────────
  const leaveStats = useMemo(() => {
    const totalLeaves = teamLeaves.length;
    const approved = teamLeaves.filter(l => l.status === 'approved').length;
    const pending = teamLeaves.filter(l => l.status === 'pending').length;
    const rejected = teamLeaves.filter(l => l.status === 'rejected').length;

    // Leave Types distribution
    const distribution: Record<string, number> = { 'Casual Leave': 0, 'Sick Leave': 0, 'Paid Leave': 0 };
    teamLeaves.filter(l => l.status === 'approved').forEach(l => {
      const type = l.leaveType || 'Casual Leave';
      if (distribution[type] !== undefined) {
        distribution[type] += l.totalDays || 1;
      }
    });

    const totalDaysTaken = Object.values(distribution).reduce((a, b) => a + b, 0);

    const typeDistribution = Object.keys(distribution).map(key => ({
      type: key,
      days: distribution[key],
      percentage: totalDaysTaken > 0 ? Math.round((distribution[key] / totalDaysTaken) * 100) : 0,
    })).sort((a, b) => b.days - a.days);

    return {
      totalLeaves,
      approved,
      pending,
      rejected,
      totalDaysTaken,
      typeDistribution,
    };
  }, [teamLeaves]);

  // ─── Expense Calculations ──────────────────────────────────────────────────
  const expenseStats = useMemo(() => {
    const approvedExpenses = teamExpenses.filter(e => 
      e.status === 'pending_manager' || 
      e.status === 'pending_finance' || 
      e.status === 'reimbursed'
    );
    const totalSpent = approvedExpenses.reduce((acc, exp) => acc + exp.amount, 0);

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
      totalRequests: teamExpenses.length,
      pendingSupervisor: teamExpenses.filter(e => e.status === 'pending_coordinator').length,
      pendingManager: teamExpenses.filter(e => e.status === 'pending_manager').length,
      reimbursed: teamExpenses.filter(e => e.status === 'reimbursed').length,
    };
  }, [teamExpenses]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'attendance') {
        const records = teamAttendance.map(log => {
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
          'Team Attendance Report',
          `Manager: ${user?.displayName || 'Manager'}`,
          records
        );
        await exportToPDF(html, 'Team_Attendance_Report');
      } else if (activeTab === 'leaves') {
        const records = teamLeaves.map(lvl => {
          const emp = employees.find(e => e.uid === lvl.employeeId);
          let formattedStart = 'N/A';
          if (lvl.startDate) {
            try {
              formattedStart = typeof lvl.startDate === 'string' ? lvl.startDate : new Date(lvl.startDate).toLocaleDateString();
            } catch (e) {}
          }
          let formattedEnd = 'N/A';
          if (lvl.endDate) {
            try {
              formattedEnd = typeof lvl.endDate === 'string' ? lvl.endDate : new Date(lvl.endDate).toLocaleDateString();
            } catch (e) {}
          }
          let daysStr = '1';
          if (lvl.totalDays !== undefined && lvl.totalDays !== null) {
            daysStr = lvl.totalDays.toString();
          }
          let statusText = 'Pending';
          if (lvl.status) {
            statusText = lvl.status.charAt(0).toUpperCase() + lvl.status.slice(1);
          }

          return {
            name: emp?.displayName || lvl.employeeName || 'Unknown Employee',
            type: lvl.leaveType || 'Casual Leave',
            dateText: formatLeaveDurationText(lvl.startDate, lvl.endDate, lvl.totalDays, lvl.durationType, lvl.halfDayPeriod),
            days: daysStr,
            reason: lvl.reason || '',
            status: statusText,
          };
        });
        const html = generateLeavesHTML(
          'Team Leaves Report',
          `Manager: ${user?.displayName || 'Manager'}`,
          records
        );
        await exportToPDF(html, 'Team_Leaves_Report');
      } else {
        const records = teamExpenses.map(exp => {
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
          'Team Expense Report',
          `Manager: ${user?.displayName || 'Manager'}`,
          records
        );
        await exportToPDF(html, 'Team_Expense_Report');
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
        const rows = teamAttendance.map(log => {
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
        await exportToCSV(headers, rows, 'Team_Attendance_Report');
      } else if (activeTab === 'leaves') {
        const headers = ['Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Total Days', 'Reason', 'Status'];
        const rows = teamLeaves.map(lvl => {
          const emp = employees.find(e => e.uid === lvl.employeeId);
          let formattedStart = 'N/A';
          if (lvl.startDate) {
            try {
              formattedStart = typeof lvl.startDate === 'string' ? lvl.startDate : new Date(lvl.startDate).toLocaleDateString();
            } catch (e) {}
          }
          let formattedEnd = 'N/A';
          if (lvl.endDate) {
            try {
              formattedEnd = typeof lvl.endDate === 'string' ? lvl.endDate : new Date(lvl.endDate).toLocaleDateString();
            } catch (e) {}
          }
          let daysStr = '1';
          if (lvl.totalDays !== undefined && lvl.totalDays !== null) {
            daysStr = lvl.totalDays.toString();
          }
          let statusText = 'Pending';
          if (lvl.status) {
            statusText = lvl.status.charAt(0).toUpperCase() + lvl.status.slice(1);
          }

          return [
            emp?.displayName || lvl.employeeName || 'Unknown Employee',
            lvl.leaveType || 'Casual Leave',
            formattedStart,
            formattedEnd,
            daysStr,
            lvl.reason || '',
            statusText,
          ];
        });
        await exportToCSV(headers, rows, 'Team_Leaves_Report');
      } else {
        const headers = ['Employee Name', 'Category', 'Date', 'Amount (INR)', 'Description', 'Status'];
        const rows = teamExpenses.map(exp => {
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
        await exportToCSV(headers, rows, 'Team_Expense_Report');
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
        <Text style={styles.headerTitle}>{user?.role === 'finance' ? 'Financial Reports' : 'Team Reports'}</Text>
        <Text style={styles.headerSubtitle}>
          {(user?.role === 'hr_manager' || user?.role === 'finance') ? 'Company-wide view for' : 'Manager view for'} {teamEmployees.length} active employees
        </Text>
      </View>

      {/* Reports Tab Selector */}
      <View style={styles.tabRow}>
        {(user?.role === 'hr_manager' 
          ? (['attendance', 'leaves'] as const) 
          : user?.role === 'finance'
            ? (['expenses'] as const)
            : (['attendance', 'leaves', 'expenses'] as const)
        ).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
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
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {activeTab === 'attendance' && (
            /* ATTENDANCE REPORT */
            <View>
              <View style={styles.mainCard}>
                <View style={styles.mainCardHeader}>
                  <Text style={styles.cardTitle}>Team Present Rate</Text>
                  <Text style={[styles.percentageText, { color: Colors.secondary }]}>
                    {attendanceStats.attendancePercentage}%
                  </Text>
                </View>
                <Text style={styles.cardDesc}>Est. Present Rate of team members</Text>

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
                </View>
              </View>

              <Text style={styles.sectionTitle}>Employee Attendance Summaries</Text>
              {attendanceStats.employeeSummaries.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No team logs found</Text>
                </View>
              ) : (
                attendanceStats.employeeSummaries.map((summary) => (
                  <View key={summary.uid} style={styles.empRow}>
                    <View style={[styles.avatar, { backgroundColor: Colors.secondary + '15' }]}>
                      <Text style={[styles.avatarTxt, { color: Colors.secondary }]}>
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
          )}

          {activeTab === 'leaves' && (
            /* LEAVES REPORT */
            <View>
              <View style={[styles.mainCard, { borderTopColor: Colors.secondary, borderTopWidth: 4 }]}>
                <Text style={styles.cardTitle}>Total Leaves Taken</Text>
                <Text style={styles.totalAmount}>{leaveStats.totalDaysTaken} Days</Text>
                <Text style={styles.cardDesc}>Total approved leave days this month</Text>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{leaveStats.approved}</Text>
                    <Text style={styles.metricLabel}>Approved</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.warning }]}>
                      {leaveStats.pending}
                    </Text>
                    <Text style={styles.metricLabel}>Pending</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.error }]}>
                      {leaveStats.rejected}
                    </Text>
                    <Text style={styles.metricLabel}>Rejected</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Leave Types Distribution</Text>
              {leaveStats.typeDistribution.length === 0 || leaveStats.totalDaysTaken === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No approved leaves logged</Text>
                </View>
              ) : (
                <View style={styles.distributionContainer}>
                  {leaveStats.typeDistribution.map((item) => (
                    <View key={item.type} style={styles.distRow}>
                      <View style={styles.distMeta}>
                        <Text style={styles.distName}>{item.type}</Text>
                        <Text style={styles.distAmount}>
                          {item.days} Days ({item.percentage}%)
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${item.percentage}%`, backgroundColor: Colors.secondary },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'expenses' && (
            /* EXPENSES REPORT */
            <View>
              <View style={[styles.mainCard, { borderTopColor: Colors.warning, borderTopWidth: 4 }]}>
                <Text style={styles.cardTitle}>Total Team Spend (Approved)</Text>
                <Text style={styles.totalAmount}>₹{expenseStats.totalSpent.toLocaleString('en-IN')}</Text>
                <Text style={styles.cardDesc}>Total amount from approved employee requests</Text>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{expenseStats.totalRequests}</Text>
                    <Text style={styles.metricLabel}>Total claims</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.warning }]}>
                      {expenseStats.pendingManager}
                    </Text>
                    <Text style={styles.metricLabel}>Pending Manager</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.success }]}>
                      {expenseStats.reimbursed}
                    </Text>
                    <Text style={styles.metricLabel}>Reimbursed</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Expense Category Distribution</Text>
              {expenseStats.categoryDistribution.length === 0 || expenseStats.totalSpent === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No approved expenses logged for team</Text>
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
                            { width: `${item.percentage}%`, backgroundColor: Colors.warning },
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
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  tabActive: {
    backgroundColor: Colors.secondary,
  },
  tabText: {
    fontSize: FontSize.xs + 1,
    color: Colors.text.secondary,
    fontWeight: FontWeight.bold,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
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
