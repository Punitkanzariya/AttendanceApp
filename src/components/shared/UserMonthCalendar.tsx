import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shadow } from '@/theme';
import type { AttendanceRecord } from '@/types';

interface UserMonthCalendarProps {
  records: AttendanceRecord[];
  selectedDate: Date;
  onDateClick?: (dateStr: string) => void;
  activeDateStr?: string;
  leaveDateSet?: Set<string>;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function UserMonthCalendar({ records, selectedDate, onDateClick, activeDateStr, leaveDateSet }: UserMonthCalendarProps) {
  const getDayStatus = (year: number, month: number, day: number) => {
    const dateObj = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Local date string in format YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = records.find((r) => r.dateStr === dateStr);

    if (record) return 'present';
    if (leaveDateSet && leaveDateSet.has(dateStr)) return 'leave';

    if (dateObj > today) return 'future';
    if (dateObj.getDay() === 0) return 'weekend'; // Sunday

    return 'absent';
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.monthTitle}>
          {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Weekday Header */}
      <View style={styles.calendarHeader}>
        {WEEKDAYS.map((wd, i) => (
          <Text key={i} style={styles.calendarHeaderText}>
            {wd}
          </Text>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wIdx) => (
        <View key={wIdx} style={styles.calendarRow}>
          {week.map((day, dIdx) => {
            if (!day) return <View key={dIdx} style={styles.calendarCell} />;

            const status = getDayStatus(year, month, day);
            let bgColor = 'transparent';
            let textColor = '#0F172A';

            if (status === 'present') {
              bgColor = '#DCFCE7'; // light green
              textColor = '#166534';
            } else if (status === 'leave') {
              bgColor = '#EDE9FE'; // light purple
              textColor = '#6D28D9';
            } else if (status === 'absent') {
              bgColor = '#FEE2E2'; // light red
              textColor = '#991B1B';
            } else if (status === 'weekend') {
              textColor = '#94A3B8';
            } else if (status === 'future') {
              textColor = '#CBD5E1';
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isActive = dateStr === activeDateStr;

            return (
              <TouchableOpacity 
                key={dIdx} 
                style={styles.calendarCell}
                activeOpacity={0.7}
                disabled={!onDateClick || status !== 'present'}
                onPress={() => onDateClick && onDateClick(dateStr)}
              >
                <View style={[
                  styles.dayCircle, 
                  { backgroundColor: bgColor },
                  isActive && { borderWidth: 2, borderColor: '#000' }
                ]}>
                  <Text style={[styles.dayText, { color: textColor }]}>{day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#166534' }]} />
          <Text style={styles.legendText}>Present</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6D28D9' }]} />
          <Text style={styles.legendText}>Leave</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#991B1B' }]} />
          <Text style={styles.legendText}>Absent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
          <Text style={styles.legendText}>Holiday/Off</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
});
