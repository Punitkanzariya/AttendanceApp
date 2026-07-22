import React, { useState, useEffect } from "react";
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
import {
  submitLeaveRequest,
} from "@/firebase/leaveService";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/utils/constants";
import { logAuditAction } from "@/firebase/auditService";
import { DateInput } from "../DateInput";
import { calculateDays } from "../../utils/dateUtils";
import type { LeaveDurationType, HalfDayPeriod, LeaveType } from "@/types";
import { SuccessPopup } from "@/components/shared/SuccessPopup";

interface LeaveModalProps {
  isVisible: boolean;
  onClose: () => void;
  userLeaveBalance?: any;
  existingLeaves?: any[];
  onSuccess?: (message: string) => void;
}

export const LeaveModal = ({
  isVisible,
  onClose,
  userLeaveBalance,
  existingLeaves = [],
  onSuccess,
}: LeaveModalProps) => {
  const { user } = useAuthStore();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const staticLeaveTypes = [
    { leaveTypeId: LEAVE_TYPES.CASUAL, name: LEAVE_TYPE_LABELS.casual },
    { leaveTypeId: LEAVE_TYPES.SICK, name: LEAVE_TYPE_LABELS.sick },
    { leaveTypeId: LEAVE_TYPES.EARNED, name: LEAVE_TYPE_LABELS.earned },
  ];
  const [leaveType, setLeaveType] = useState<string>("");
  const [durationType, setDurationType] =
    useState<LeaveDurationType>("single_day");
  const [halfDayPeriod, setHalfDayPeriod] =
    useState<HalfDayPeriod>("first_half");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorPopup, setErrorPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

  useEffect(() => {
    if (isVisible) {
      setStartDate("");
      setEndDate("");
      setLeaveType(LEAVE_TYPES.CASUAL);
      setReason("");
      setDurationType("single_day");
      setHalfDayPeriod("first_half");
    }
  }, [isVisible]);

  const todayDate = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    const isSingleDate =
      durationType === "single_day" || durationType === "half_day";
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

    const showAlert = (title: string, message: string) => {
      setErrorPopup({ visible: true, title, message });
    };

    if (days <= 0) {
      showAlert(
        "Invalid Dates",
        "The end date must be on or after the start date.",
      );
      return;
    }

    // 1. Same-day / Overlapping Leave Validation
    if (existingLeaves && existingLeaves.length > 0) {
      const start = new Date(startDate);
      const end = new Date(actualEndDate);
      // Reset hours to compare purely by date
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const hasOverlap = existingLeaves.some((l) => {
        if (l.status === "rejected" || l.status === "cancelled") return false;

        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        lStart.setHours(0, 0, 0, 0);
        lEnd.setHours(0, 0, 0, 0);

        return start <= lEnd && end >= lStart;
      });

      if (hasOverlap) {
        showAlert(
          "Dates Overlapping",
          "You have already applied for a leave that overlaps with these dates.",
        );
        return;
      }
    }

    // 2. Insufficient Leave Balance Validation
    let remainingBalance = 0;
    const leaveTypeObj = staticLeaveTypes.find((t) => t.leaveTypeId === leaveType);
    const typeName = leaveTypeObj?.name || leaveType;

    let categoryKey = leaveType;
    if (leaveTypeObj?.name.toLowerCase().includes("sick")) categoryKey = "sick";
    if (leaveTypeObj?.name.toLowerCase().includes("casual"))
      categoryKey = "casual";
    if (leaveTypeObj?.name.toLowerCase().includes("earned"))
      categoryKey = "earned";

    if (userLeaveBalance && userLeaveBalance[categoryKey] !== undefined) {
      const max = userLeaveBalance[categoryKey];
      const taken = userLeaveBalance[`${categoryKey}Taken`] || 0;
      remainingBalance = Math.max(0, max - taken);

      if (days > remainingBalance) {
        showAlert(
          "Insufficient Balance",
          `Insufficient balance. You only have ${remainingBalance} ${typeName} remaining, but you applied for ${days} days.`,
        );
        return;
      }
    } else if (user?.leaveBalances?.[categoryKey] !== undefined) {
      const max = user.leaveBalances[categoryKey];
      const taken = 0; // fallback if exact taken not tracked in legacy structure
      remainingBalance = Math.max(0, max - taken);
      if (days > remainingBalance) {
        showAlert(
          "Insufficient Balance",
          `Insufficient balance. You only have ${remainingBalance} ${typeName} remaining, but you applied for ${days} days.`,
        );
        return;
      }
    } else if (leaveTypeObj?.annualQuota !== undefined) {
      const max = leaveTypeObj.annualQuota;
      // Without balance data, this is a rough fallback. If needed, assume 0 taken.
      // We skip strict validation here if we don't know the taken amount, to be safe.
    }

    setIsSubmitting(true);
    try {
      await submitLeaveRequest(
        user!.uid,
        user!.displayName || user!.username,
        user!.projectId || "",
        leaveType,
        startDate,
        actualEndDate,
        days,
        reason,
        durationType,
        durationType === "half_day" ? halfDayPeriod : undefined,
      );

      await logAuditAction({
        userId: user!.uid,
        userEmail: user!.email || "",
        userName: user!.displayName || "Unknown",
        userRole: user!.role || "employee",
        module: "leave",
        action: "SUBMIT",
        description: `Applied for ${days} days of ${leaveType} leave`,
        severity: "low",
      });

      setStartDate("");
      setEndDate("");
      setReason("");
      if (leaveTypes.length > 0) setLeaveType(leaveTypes[0].leaveTypeId);
      setDurationType("single_day");
      setHalfDayPeriod("first_half");

      onClose();
      if (onSuccess)
        onSuccess("Your leave request has been submitted successfully.");
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
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
              {staticLeaveTypes.map((type) => (
                <TouchableOpacity
                  key={type.leaveTypeId}
                  style={[
                    styles.typeButton,
                    leaveType === type.leaveTypeId && styles.typeButtonActive,
                  ]}
                  onPress={() => setLeaveType(type.leaveTypeId)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      leaveType === type.leaveTypeId &&
                        styles.typeButtonTextActive,
                    ]}
                  >
                    {type.name}
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
                      onPress={() =>
                        setHalfDayPeriod(period.id as HalfDayPeriod)
                      }
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          halfDayPeriod === period.id &&
                            styles.typeButtonTextActive,
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

            {durationType === "multiple_days" &&
              !!startDate &&
              !!endDate &&
              calculateDays(startDate, endDate) > 0 && (
                <Text style={styles.totalDaysPreview}>
                  Total Duration: {calculateDays(startDate, endDate)} Days
                </Text>
              )}

            {durationType === "single_day" && !!startDate && (
              <Text style={styles.totalDaysPreview}>Total Duration: 1 Day</Text>
            )}

            {durationType === "half_day" && !!startDate && (
              <Text style={styles.totalDaysPreview}>
                Total Duration: 0.5 Days
              </Text>
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

      {/* Custom Error Popup */}
      <Modal
        visible={errorPopup.visible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.errorOverlay}>
          <View style={styles.errorContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={40} color={Colors.error} />
            </View>
            <Text style={styles.errorTitle}>{errorPopup.title}</Text>
            <Text style={styles.errorMessage}>{errorPopup.message}</Text>
            <TouchableOpacity
              style={styles.errorBtn}
              activeOpacity={0.7}
              onPress={() =>
                setErrorPopup((prev) => ({ ...prev, visible: false }))
              }
            >
              <Text style={styles.errorBtnText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    paddingHorizontal: 16,
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
  errorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.error + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBtn: {
    backgroundColor: Colors.error,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.full,
    width: "100%",
    alignItems: "center",
  },
  errorBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});
