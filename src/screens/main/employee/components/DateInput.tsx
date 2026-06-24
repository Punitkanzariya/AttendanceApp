import React, { createElement, useState } from "react";
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { formatDateDDMMYYYY } from '@/utils/dateUtils';

export const DateInput = ({
  value,
  onChangeText,
  placeholder,
  min,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  min?: string;
}) => {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date",
      value: value,
      min: min,
      onChange: (e: any) => onChangeText(e.target.value),
      placeholder: placeholder,
      style: {
        width: "100%",
        padding: "12px",
        fontSize: "16px",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        marginBottom: "12px",
        boxSizing: "border-box",
        fontFamily: "inherit",
        color: "#111827",
      },
    });
  }

  const [show, setShow] = useState(false);
  const currentDate = value ? new Date(value) : new Date();
  const minDate = min ? new Date(min) : undefined;

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split("T")[0];
      onChangeText(formatted);
    }
  };

  const showPicker = () => setShow(true);
  const hidePicker = () => setShow(false);

  const getDisplayValue = () => {
    if (!value) return "";
    try {
      const dateObj = new Date(value);
      return formatDateDDMMYYYY(dateObj);
    } catch {
      return value;
    }
  };

  return (
    <View style={{ width: "100%", marginBottom: 12 }}>
      <TouchableOpacity
        style={styles.inputField}
        activeOpacity={0.7}
        onPress={showPicker}
      >
        <Text style={[styles.inputText, !value && styles.inputPlaceholder]}>
          {getDisplayValue() || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
      </TouchableOpacity>

      {/* Android DateTimePicker */}
      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          minimumDate={minDate}
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* iOS DateTimePicker inside bottom sheet Modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={show}
          transparent={true}
          animationType="slide"
          onRequestClose={hidePicker}
        >
          <View style={styles.iosBackdrop}>
            <View style={styles.iosContainer}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={hidePicker}>
                  <Text style={styles.iosCancelBtn}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.iosTitle}>Select Date</Text>
                <TouchableOpacity onPress={hidePicker}>
                  <Text style={styles.iosDoneBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={currentDate}
                  mode="date"
                  minimumDate={minDate}
                  display="spinner"
                  textColor="#111827"
                  onChange={handleDateChange}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputField: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  inputPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  iosBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  iosContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iosTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  iosCancelBtn: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  iosDoneBtn: {
    fontSize: 15,
    color: "#2563EB",
    fontWeight: "700",
  },
  iosPickerWrap: {
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
