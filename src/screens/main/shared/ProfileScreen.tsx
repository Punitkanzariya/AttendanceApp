import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { updateProfile } from "firebase/auth";
import { auth } from "@/firebase/config";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@/store/authStore";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import GradientHeader from "@/components/shared/GradientHeader";
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { Project } from "@/types";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<any>();
  const [managerName, setManagerName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [assignedProject, setAssignedProject] = useState<string | null>(null);
  const [assignedShift, setAssignedShift] = useState<string | null>(null);
  const [projectManager, setProjectManager] = useState<string | null>(null);
  const [projectCoordinator, setProjectCoordinator] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeManager: (() => void) | undefined;
    let unsubscribeProject: (() => void) | undefined;

    if (user?.managerId) {
      unsubscribeManager = onSnapshot(doc(db, "users", user.managerId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.displayName) {
            setManagerName(data.displayName);
          }
        } else {
          setManagerName(null);
        }
      }, (err) => console.warn("Failed to listen to manager name:", err));
    } else {
      setManagerName(null);
    }

    if (user?.role === 'employee') {
      const q = query(collection(db, 'projects'), where('isClosed', '==', false));
      unsubscribeProject = onSnapshot(q, (snapshot) => {
        let foundProject = false;
        for (const docSnap of snapshot.docs) {
          const projData = docSnap.data() as Project;
          if (projData.siteEmployees) {
            const empRecord = projData.siteEmployees.find(e => e.employeeId === user.uid);
            if (empRecord) {
              setAssignedProject(projData.projectName);
              setAssignedShift(empRecord.shift);
              setProjectManager(projData.projectManagerName || null);
              setProjectCoordinator(projData.projectCoordinatorName || null);
              foundProject = true;
              break;
            }
          }
        }
        if (!foundProject) {
          setAssignedProject(null);
          setAssignedShift(null);
          setProjectManager(null);
          setProjectCoordinator(null);
        }
      }, (err) => console.warn("Failed to listen to projects:", err));
    }

    return () => {
      if (unsubscribeManager) unsubscribeManager();
      if (unsubscribeProject) unsubscribeProject();
    };
  }, [user?.managerId, user?.uid, user?.role]);

  const renderRow = (label: string, value: string, noBorder = false) => (
    <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );

  const formatRole = (role?: string) => {
    if (!role) return "N/A";
    return role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  const formatJoinedDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const dateObj = new Date(isoString);
      return formatDateDDMMYYYY(dateObj);
    } catch {
      return "N/A";
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setIsUploading(true);
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;

        if (auth.currentUser && user?.role) {
          // Update Firestore (Bypass Firebase Auth photoURL length limit)
          await updateDoc(doc(db, "users", user.role, "profiles", user.uid), {
            photoURL: base64Uri,
          });

          // Update local state
          const updatedUser = { ...user!, photoURL: base64Uri };
          useAuthStore.setState({ user: updatedUser });
        }
      }
    } catch (error) {
      console.error("Error updating profile picture", error);
      Alert.alert("Error", "Failed to update profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.root}>
        {/* Background Gradient */}
        <GradientHeader />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Profile Header */}
          <View
            style={{
              alignItems: "center",
              marginTop: 10,
              marginBottom: Spacing.lg,
              position: "relative",
            }}
          >
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation?.goBack?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.avatar} 
              onPress={handlePickImage} 
              activeOpacity={0.8}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitials(user?.displayName)}
                </Text>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>
              {user?.displayName || "Your account"}
            </Text>
            <Text style={styles.profilePhone}>
              {user?.phoneNumber || "N/A"}
            </Text>
            <Text style={styles.profilePhone}>@{user?.username || "N/A"}</Text>
          </View>

          {/* Profile Details */}
          <View style={styles.card}>
            <View style={styles.detailsContainer}>
              {renderRow(
                "Employee Code",
                user?.employeeId || user?.uid.slice(0, 8).toUpperCase() || "EMP001",
              )}
              {renderRow("Date of Birth", user?.dateOfBirth || "N/A")}
              {renderRow("Job Position", formatRole(user?.role))}
              {user?.role === 'employee' && renderRow("Assigned Project", assignedProject || "Not Assigned")}
              {user?.role === 'employee' && renderRow("Shift", assignedShift || "Not Assigned")}
              {user?.role === 'employee' && renderRow("Project Manager", projectManager || "Not Assigned")}
              {user?.role === 'employee' && renderRow("Project Coordinator", projectCoordinator || "Not Assigned", true)}
              {(user?.panCard || user?.aadharCard) && (
                <View style={[styles.row, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={styles.label}>Documents</Text>
                  <TouchableOpacity onPress={() => setIsDocModalVisible(true)} style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>View Details</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutCard}
            onPress={logout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Document Modal */}
      <Modal visible={isDocModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Documents</Text>
              <TouchableOpacity onPress={() => setIsDocModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md }}>
              {user?.panCard && (
                <View style={styles.docSection}>
                  <Text style={styles.docLabel}>PAN Card Number</Text>
                  <Text style={styles.docValue}>{user.panCard}</Text>
                  {user.panCardPhotoUrl && (
                    <Image source={{ uri: user.panCardPhotoUrl }} style={styles.docImage} resizeMode="contain" />
                  )}
                </View>
              )}
              
              {user?.aadharCard && (
                <View style={styles.docSection}>
                  <Text style={styles.docLabel}>Aadhar Card Number</Text>
                  <Text style={styles.docValue}>{user.aadharCard}</Text>
                  
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {user.aadharCardPhotoUrl && (
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docLabel, { fontSize: 11, marginBottom: 2 }]}>Front Side</Text>
                        <Image source={{ uri: user.aadharCardPhotoUrl }} style={[styles.docImage, { height: 120 }]} resizeMode="contain" />
                      </View>
                    )}
                    {user.aadharCardBackPhotoUrl && (
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docLabel, { fontSize: 11, marginBottom: 2 }]}>Back Side</Text>
                        <Image source={{ uri: user.aadharCardBackPhotoUrl }} style={[styles.docImage, { height: 120 }]} resizeMode="contain" />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#BFDBFE",
  },
  root: {
    flex: 1,
    position: "relative",
    backgroundColor: Colors.employeeBg,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    width: "100%",
    elevation: 2,
    shadowColor: "#0000005d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginTop: 6,
  },
  profilePhone: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.primary,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  },
  detailsContainer: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  label: {
    fontSize: 13,
    color: "#64748B",
    flex: 1,
    fontWeight: "500",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    flex: 2,
    textAlign: "right",
  },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    width: "100%",
    elevation: 2,
    shadowColor: "#0000005d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "bold",
    color: Colors.text.primary,
  },
  closeBtn: {
    padding: 4,
  },
  docSection: {
    marginBottom: Spacing.lg,
    backgroundColor: '#F8FAFC',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  docValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  docImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginTop: Spacing.xs,
  },
});
