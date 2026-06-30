import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { submitLeaveRequest } from "@/firebase/leaveService";
import { DateInput } from "../DateInput";
import { calculateDays } from "../../utils/dateUtils";
import type { LeaveDurationType, HalfDayPeriod } from "@/types";

interface LeaveModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const LeaveModal = ({ isVisible, onClose }: LeaveModalProps) => {
  const { user } = useAuthStore();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [durationType, setDurationType] = useState<LeaveDurationType>("single_day");
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>("first_half");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayDate = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    const isSingleDate = durationType === "single_day" || durationType === "half_day";
    const actualEndDate = isSingleDate ? startDate : endDate;

    if (!startDate || (!isSingleDate && !actualEndDate) || !reason) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    let days = 0;
    if (durationType === "half_day") {
      days = 0.5;
    } else if (durationType === "single_day") {
      days = 1;
    } else {
      days = calculateDays(startDate, actualEndDate);
    }

    if (days <= 0) {
      Alert.alert("Error", "End date must be on or after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLeaveRequest(
        user!.uid,
        user!.role,
        user!.displayName || user!.username,
        leaveType,
        startDate,
        actualEndDate,
        days,
        reason,
        durationType,
        durationType === "half_day" ? halfDayPeriod : undefined
      );
      onClose();
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("Casual Leave");
      setDurationType("single_day");
      setHalfDayPeriod("first_half");
    } catch (error) {
      console.error("Failed to submit leave:", error);
      Alert.alert("Error", "Failed to submit leave request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Leave Type</Text>
            <View style={styles.typeSelectorRow}>
              {["Casual Leave", "Sick Leave", "Paid Leave"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    leaveType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setLeaveType(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      leaveType === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Duration</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { id: "single_day", label: "Single Day" },
                { id: "multiple_days", label: "Multiple Days" },
                { id: "half_day", label: "Half Day" },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    durationType === type.id && styles.typeButtonActive,
                  ]}
                  onPress={() => setDurationType(type.id as LeaveDurationType)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      durationType === type.id && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {durationType === "half_day" && (
              <>
                <Text style={styles.inputLabel}>Period</Text>
                <View style={styles.typeSelectorRow}>
                  {[
                    { id: "first_half", label: "First Half" },
                    { id: "second_half", label: "Second Half" },
                  ].map((period) => (
                    <TouchableOpacity
                      key={period.id}
                      style={[
                        styles.typeButton,
                        halfDayPeriod === period.id && styles.typeButtonActive,
                      ]}
                      onPress={() => setHalfDayPeriod(period.id as HalfDayPeriod)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          halfDayPeriod === period.id && styles.typeButtonTextActive,
                        ]}
                      >
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>
              {durationType === "multiple_days" ? "From Date" : "Date"}
            </Text>
            <DateInput
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              min={todayDate}
            />

            {durationType === "multiple_days" && (
              <>
                <Text style={styles.inputLabel}>To Date</Text>
                <DateInput
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                  min={todayDate}
                />
              </>
            )}

            {durationType === "multiple_days" && !!startDate && !!endDate && calculateDays(startDate, endDate) > 0 && (
              <Text style={styles.totalDaysPreview}>
                Total Duration: {calculateDays(startDate, endDate)} Days
              </Text>
            )}

            {durationType === "single_day" && !!startDate && (
              <Text style={styles.totalDaysPreview}>Total Duration: 1 Day</Text>
            )}

            {durationType === "half_day" && !!startDate && (
              <Text style={styles.totalDaysPreview}>Total Duration: 0.5 Days</Text>
            )}

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why are you requesting leave?"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    maxHeight: "90%",
  },
  scrollContent: {
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  typeButtonTextActive: { color: Colors.white, fontWeight: FontWeight.bold },
  totalDaysPreview: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: 12,
    textAlign: "right",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 12,
    fontSize: FontSize.md,
    marginBottom: 12,
    color: Colors.text.primary,
  },
  textArea: {
    height: 100,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});
