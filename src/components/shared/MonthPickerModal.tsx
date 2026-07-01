import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthPickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

export default function MonthPickerModal({
  visible,
  selectedDate,
  onClose,
  onSelect,
}: MonthPickerModalProps) {
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());

  // Sync year when selectedDate changes
  useEffect(() => {
    setPickerYear(selectedDate.getFullYear());
  }, [selectedDate, visible]);

  const canGoNextYear = pickerYear < today.getFullYear();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.card}>
        {/* Year Navigation */}
        <View style={styles.yearRow}>
          <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.yearBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{pickerYear}</Text>
          <TouchableOpacity
            onPress={() => { if (canGoNextYear) setPickerYear(y => y + 1); }}
            style={[styles.yearBtn, !canGoNextYear && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Month Grid */}
        <View style={styles.grid}>
          {MONTHS.map((m, idx) => {
            const isSelected = idx === selectedDate.getMonth() && pickerYear === selectedDate.getFullYear();
            const isFuture = new Date(pickerYear, idx, 1) > today;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.monthCell, isSelected && styles.monthCellSelected, isFuture && styles.monthCellDisabled]}
                onPress={() => {
                  if (isFuture) return;
                  const d = new Date(pickerYear, idx, 1);
                  onSelect(d);
                }}
                activeOpacity={isFuture ? 1 : 0.7}
              >
                <Text style={[styles.monthText, isSelected && styles.monthTextSelected, isFuture && styles.monthTextDisabled]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    position: 'absolute',
    top: '30%',
    left: 24, right: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  yearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingHorizontal: 4,
  },
  yearBtn: { padding: 6 },
  yearText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '22%', paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#F1F5F9',
    marginBottom: 4,
  },
  monthCellSelected: { backgroundColor: Colors.primary },
  monthCellDisabled: { backgroundColor: '#F8FAFC' },
  monthText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  monthTextSelected: { color: '#fff' },
  monthTextDisabled: { color: '#CBD5E1' },
});
