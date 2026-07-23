import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/theme';

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

interface MonthPickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

function WheelPicker({
  items,
  selectedIndex,
  onChange
}: {
  items: { label: string; value: number }[];
  selectedIndex: number;
  onChange: (val: number) => void;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [internalIndex, setInternalIndex] = useState(selectedIndex);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 50);
  }, [selectedIndex]);

  const handleSnap = (offsetY: number) => {
    const idx = Math.round(offsetY / ITEM_HEIGHT);
    const safeIdx = Math.max(0, Math.min(idx, items.length - 1));
    if (safeIdx !== internalIndex) {
      setInternalIndex(safeIdx);
    }
    onChange(items[safeIdx].value);
    scrollViewRef.current?.scrollTo({ y: safeIdx * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={styles.wheelContainer}>
      <View style={styles.selectionHighlight} pointerEvents="none" />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (idx >= 0 && idx < items.length && idx !== internalIndex) {
            setInternalIndex(idx);
          }
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => handleSnap(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          // If there is no momentum (velocity is near 0), force snap
          if (Math.abs(e.nativeEvent.velocity?.y || 0) < 0.1) {
            handleSnap(e.nativeEvent.contentOffset.y);
          }
        }}
      >
        {items.map((it, i) => (
          <View key={i} style={styles.wheelItem}>
            <Text
              style={[
                styles.wheelItemText,
                i === internalIndex && styles.wheelItemTextSelected,
              ]}
            >
              {it.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function MonthPickerModal({
  visible,
  selectedDate,
  onClose,
  onSelect,
}: MonthPickerModalProps) {
  const today = new Date();
  const [tempYear, setTempYear] = useState(selectedDate.getFullYear());
  const [tempMonth, setTempMonth] = useState(selectedDate.getMonth());

  useEffect(() => {
    if (visible) {
      setTempYear(selectedDate.getFullYear());
      setTempMonth(selectedDate.getMonth());
    }
  }, [selectedDate, visible]);

  const currentYear = today.getFullYear();
  const yearItems = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearItems.push({ label: y.toString(), value: y });
  }
  const yearIndex = Math.max(0, yearItems.findIndex(y => y.value === tempYear));

  const monthItems = FULL_MONTHS.map((m, i) => ({ label: m, value: i }));

  const handleConfirm = () => {
    onSelect(new Date(tempYear, tempMonth, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerRow}>
            <WheelPicker
              items={yearItems}
              selectedIndex={yearIndex}
              onChange={(val) => setTempYear(val)}
            />
            <WheelPicker
              items={monthItems}
              selectedIndex={tempMonth}
              onChange={(val) => setTempMonth(val)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cancelBtn: {
    fontSize: 16,
    color: '#64748B',
  },
  confirmBtn: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  pickerRow: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  wheelContainer: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: 'rgba(226, 232, 240, 0.2)',
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '400',
  },
  wheelItemTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 20,
  },
});
