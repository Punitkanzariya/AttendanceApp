import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing } from '@/theme';

interface Option {
  label: string;
  value: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onConfirm: (values: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({ label, options, selectedValues, onConfirm, placeholder = 'Select...' }: MultiSelectDropdownProps) {
  const [visible, setVisible] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(selectedValues));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setTempSelected(new Set(selectedValues));
      setSearchQuery('');
    }
  }, [visible, selectedValues]);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleOption = (value: string) => {
    const newSet = new Set(tempSelected);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    setTempSelected(newSet);
  };

  const handleSave = () => {
    onConfirm(Array.from(tempSelected));
    setVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={[styles.selectedText, selectedValues.length === 0 && { color: Colors.text.tertiary }]}>
          {selectedValues.length > 0 ? `${selectedValues.length} Selected` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={item => item.value}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
              renderItem={({ item }) => {
                const isSelected = tempSelected.has(item.value);
                return (
                  <TouchableOpacity 
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]} 
                    onPress={() => toggleOption(item.value)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results found.</Text>
              }
            />

            <View style={styles.footer}>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
                <Text style={styles.confirmBtnText}>Confirm Selection ({tempSelected.size})</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  selectedText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text.primary,
    outlineStyle: 'none' as any,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRowSelected: {
    backgroundColor: Colors.primary + '10',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    marginRight: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  optionTextSelected: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.text.tertiary,
    padding: Spacing.xl,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: FontSize.md,
  },
});
