import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import * as DocumentPicker from "expo-document-picker";
import {
  submitExpenseRequest,
  updateExpenseRequest,
  checkDuplicateExpense,
  saveExpenseDraft,
  getExpenseDraft,
} from "@/firebase/expenseService";
import type { ExpenseRequest } from "@/types";

interface ExpenseModalProps {
  isVisible: boolean;
  onClose: () => void;
  expenseToEdit?: ExpenseRequest | null;
}

export const ExpenseModal = ({
  isVisible,
  onClose,
  expenseToEdit,
}: ExpenseModalProps) => {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Travel");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<{
    uri: string;
    name: string;
  } | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize or Load Draft
  useEffect(() => {
    if (expenseToEdit) {
      setAmount(expenseToEdit.amount.toString());
      setCategory(expenseToEdit.category);
      setDate(expenseToEdit.date);
      setDescription(expenseToEdit.description);
      setExistingAttachmentUrl(expenseToEdit.attachmentUrl || null);
      setAttachment(null);
    } else {
      // If we're opening as new, let's see if we have a draft
      if (isVisible) {
        const loadDraft = async () => {
          const draft = await getExpenseDraft();
          if (draft) {
            if (draft.amount) setAmount(draft.amount.toString());
            if (draft.category) setCategory(draft.category);
            if (draft.description) setDescription(draft.description);
            if (draft.date) setDate(draft.date);
          }
        };
        loadDraft();
      }
    }
  }, [expenseToEdit, isVisible]);

  // Save Draft (only if not editing)
  useEffect(() => {
    if (!expenseToEdit && (amount || description)) {
      saveExpenseDraft({
        amount: parseFloat(amount) || 0,
        category,
        description,
        date,
      });
    }
  }, [amount, category, description, date, expenseToEdit]);

  const handleClose = () => {
    if (expenseToEdit) {
      setAmount("");
      setDescription("");
      setAttachment(null);
    }
    setErrorMessage("");
    onClose();
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachment({
          uri: result.assets[0].uri,
          name: result.assets[0].name,
        });
      }
    } catch (err) {
      console.error("Error picking document", err);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const executeSubmit = async () => {
    try {
      if (expenseToEdit) {
        await updateExpenseRequest(
          expenseToEdit.id,
          user!.uid,
          user!.role,
          category,
          parseFloat(amount),
          date,
          description,
          attachment?.uri || null,
          existingAttachmentUrl,
        );
      } else {
        await submitExpenseRequest(
          user!.uid,
          user!.role,
          user!.displayName || "Employee",
          category,
          parseFloat(amount),
          date,
          description,
          attachment?.uri || null,
        );
      }

      handleClose();
      setAmount("");
      setDescription("");
      setAttachment(null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to submit expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setErrorMessage("");

    const missing = [];
    if (!amount) missing.push("Amount");
    if (!date) missing.push("Date");
    if (!description) missing.push("Description");
    if (!attachment && !existingAttachmentUrl) missing.push("Attachment (Bill/Photo)");

    if (missing.length > 0) {
      setErrorMessage(`Please provide: ${missing.join(", ")}`);
      return;
    }

    if (isNaN(parseFloat(amount))) {
      setErrorMessage("Amount must be a valid number.");
      return;
    }

    setIsSubmitting(true);

    if (!expenseToEdit) {
      // Check for duplicates
      const isDuplicate = await checkDuplicateExpense(
        user!.uid,
        parseFloat(amount),
        date,
        category,
      );

      if (isDuplicate) {
        setIsSubmitting(false);
        Alert.alert(
          "Duplicate Detected",
          "An expense with the same amount, date, and category already exists. Are you sure you want to submit?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Submit Anyway", onPress: () => { setIsSubmitting(true); executeSubmit(); } },
          ],
        );
        return;
      }
    }

    await executeSubmit();
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
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
              <Text style={styles.modalTitle}>
                {expenseToEdit ? "Edit Expense" : "New Expense"}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.typeSelectorRow}>
              {["Travel", "Meals", "Fuel", "Supplies", "Other"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    category === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setCategory(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      category === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1500"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Date</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 8,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
              />
            )}

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Attachment (Required)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.uploadBtnText}>
                {attachment
                  ? attachment.name
                  : existingAttachmentUrl
                    ? "Replace existing bill"
                    : "Upload Bill (PDF/JPG)"}
              </Text>
            </TouchableOpacity>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {expenseToEdit ? "Resubmit Expense" : "Submit Expense"}
                </Text>
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
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
  },
  scrollContent: { padding: 16 },
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
    paddingHorizontal: 12,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: "28%",
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
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 12,
    fontSize: FontSize.md,
    marginBottom: 12,
    color: Colors.text.primary,
  },
  textArea: { height: 80 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#EFF6FF",
  },
  uploadBtnText: {
    color: Colors.primary,
    fontWeight: "600",
    fontSize: FontSize.sm,
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
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    flex: 1,
  },
});
