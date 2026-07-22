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
  Platform,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { auth } from "@/firebase/config";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@/store/authStore";
import { Colors, FontSize, Spacing, BorderRadius } from "@/theme";
import { formatDateDDMMYYYY } from "@/utils/dateUtils";
import { LinearGradient } from "expo-linear-gradient";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase/config";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<any>();
  const [managerName, setManagerName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [isFullViewerVisible, setIsFullViewerVisible] = useState(false);
  const [fullViewerUrl, setFullViewerUrl] = useState<string | null>(null);

  const viewDocument = async (url: string) => {
    setFullViewerUrl(url);
    setIsDocModalVisible(false); // Hide the doc modal first
    setTimeout(() => {
      setIsFullViewerVisible(true);
    }, 100);
  };

  const downloadDocument = async (
    url: string,
    docType: string = "Document",
  ) => {
    try {
      const fsAny = FileSystem as any;
      const baseDir = fsAny.documentDirectory || fsAny.cacheDirectory;

      const userName = user?.firstName
        ? `${user.firstName}${user.lastName ? "_" + user.lastName : ""}`.replace(
            /\s+/g,
            "",
          )
        : user?.displayName?.replace(/\s+/g, "") || "User";

      const safeDocType = docType.replace(/\s+/g, "_");

      let ext = "pdf";
      try {
        const parts = url.split("?")[0].split(".");
        if (parts.length > 1) {
          ext = parts[parts.length - 1];
          if (ext.length > 5 || ext.includes("/")) ext = "pdf";
        }
      } catch (e) {}

      const fileName = `${userName}_${safeDocType}.${ext}`;
      const fileUri = `${baseDir}${fileName}`;
      const downloadedFile = await FileSystem.downloadAsync(
        url,
        fileUri as string,
      );

      if (Platform.OS === "ios") {
        await Sharing.shareAsync(downloadedFile.uri);
      } else {
        try {
          let directoryUri = await AsyncStorage.getItem("downloadDirectoryUri");
          let hasPermission = !!directoryUri;

          if (!hasPermission) {
            // Request new permission ONLY if we don't have it saved
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              directoryUri = permissions.directoryUri;
              await AsyncStorage.setItem("downloadDirectoryUri", directoryUri);
              hasPermission = true;
            }
          }

          if (hasPermission && directoryUri) {
            const base64 = await FileSystem.readAsStringAsync(downloadedFile.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const mimeType = ext === "pdf" ? "application/pdf" : `image/${ext}`;
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
              directoryUri,
              fileName,
              mimeType
            );
            await FileSystem.writeAsStringAsync(newUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert("Success", "Document downloaded seamlessly!");
          } else {
            // Fallback to sharing if user cancels folder selection
            await Sharing.shareAsync(downloadedFile.uri);
          }
        } catch (e) {
          console.error("Storage Error:", e);
          // Fallback to sharing
          await Sharing.shareAsync(downloadedFile.uri);
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to download document");
    }
  };

  useEffect(() => {
    let unsubscribeManager: (() => void) | undefined;
    let unsubscribeProject: (() => void) | undefined;

    if (user?.managerId) {
      unsubscribeManager = onSnapshot(
        doc(db, "users", user.managerId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.displayName) {
              setManagerName(data.displayName);
            }
          } else {
            setManagerName(null);
          }
        },
        (err) => console.warn("Failed to listen to manager name:", err),
      );
    } else {
      setManagerName(null);
    }

    return () => {
      if (unsubscribeManager) unsubscribeManager();
    };
  }, [user?.managerId]);

  const projectData = useAuthStore((s) => s.projectData);
  const {
    assignedProject = null,
    assignedShift = null,
    assignedShiftName = null,
    projectManager = null,
    projectCoordinator = null,
  } = projectData || {};

  // No local fetching needed anymore, it's handled globally
  const isFetchingProject = !projectData && user?.projectId;

  const renderInfoRow = (
    icon: string,
    label: string,
    value: any,
    noBorder = false,
  ) => (
    <View style={[styles.infoRow, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconWrapper}>
        <Ionicons name={icon as any} size={18} color="#94A3B8" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
        {typeof value === "string" ? (
          <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
            {value}
          </Text>
        ) : (
          <View style={{ flex: 1, alignItems: "flex-start", marginTop: 2 }}>
            {value}
          </View>
        )}
      </View>
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
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setIsUploading(true);
        const uriToUpload = result.assets[0].uri;

        if (auth.currentUser && user?.uid) {
          const response = await fetch(uriToUpload);
          const blob = await response.blob();

          let ext = uriToUpload.split(".").pop()?.toLowerCase() || "jpg";
          if (ext.length > 4 || ext.includes("/")) ext = "jpg";

          const fileName = `avatar_${Date.now()}.${ext}`;
          const storageRef = ref(
            storage,
            `employees/${user.uid}/profile/${fileName}`,
          );

          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          // Update Firestore using the new flat users collection
          await updateDoc(doc(db, "users", user.uid), {
            profilePicture: downloadUrl,
          });

          // Update local state
          const updatedUser = { ...user!, profilePicture: downloadUrl };
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation?.goBack?.()}
        >
          <Ionicons name="arrow-back" size={24} color="#94A3B8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity 
          style={styles.iconBtn}
          onPress={() => navigation?.navigate("Notifications")}
        >
          <Ionicons name="notifications-outline" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <LinearGradient
            colors={["#E9D5FF", "#C7D2FE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCard}
          />
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={handlePickImage}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : user?.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitials(user?.displayName)}
                </Text>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>
            {user?.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : user?.displayName || "Your account"}
          </Text>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={14} color="#64748B" />
            <Text style={styles.contactText}>
              {user?.phoneNumber || "+1 (555) 123-4567"}
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={14} color="#64748B" />
            <Text style={styles.contactText}>{user?.email || "No Email"}</Text>
          </View>
        </View>

        {/* Personal Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#E0F2FE" }]}>
              <Ionicons name="person-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>Personal</Text>
          </View>
          <View style={styles.sectionContent}>
            {renderInfoRow(
              "calendar-outline",
              "Date of Birth",
              formatDateDDMMYYYY(user?.dateOfBirth) || "N/A",
            )}
            {renderInfoRow(
              "phone-portrait-outline",
              "Mobile",
              user?.phoneNumber || "+1 (555) 123-4567",
            )}
            {renderInfoRow("at-outline", "Email", user?.email || "N/A", true)}
          </View>
        </View>

        {/* Work Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="briefcase-outline" size={20} color="#EF4444" />
            </View>
            <Text style={styles.sectionTitle}>Work</Text>
          </View>
          <View style={styles.sectionContent}>
            {renderInfoRow(
              "id-card-outline",
              "Username",
              user?.username || user?.uid.slice(0, 8).toUpperCase() || "N/A",
            )}
            {renderInfoRow(
              "business-outline",
              "Department",
              user?.department || "N/A",
            )}
            {renderInfoRow(
              "person-circle-outline",
              "Designation",
              user?.designation || formatRole(user?.role),
            )}
            {user?.role === "employee" &&
              renderInfoRow(
                "layers-outline",
                "Project",
                isFetchingProject ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  assignedProject || "Not Assigned"
                ),
              )}
            {user?.role === "employee" &&
              renderInfoRow(
                "time-outline",
                "Shift",
                isFetchingProject ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : assignedShift ? (
                  <View style={{ alignItems: "flex-start" }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#0F172A",
                      }}
                    >
                      {assignedShift}
                    </Text>
                    {assignedShiftName ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.text.secondary,
                          marginTop: 2,
                        }}
                      >
                        ({assignedShiftName})
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  "Not Assigned"
                ),
              )}
            {user?.role === "employee" &&
              renderInfoRow(
                "people-outline",
                "Manager",
                isFetchingProject ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  projectManager || "Not Assigned"
                ),
                true,
              )}
          </View>
        </View>

        {/* Documents */}
        {user?.documents && user.documents.length > 0
          ? user.documents.map((docItem, index) => (
              <View
                key={docItem.id || index.toString()}
                style={styles.sectionCard}
              >
                <View
                  style={[
                    styles.sectionContent,
                    { paddingVertical: Spacing.sm },
                  ]}
                >
                  <View style={styles.docHeaderRow}>
                    <View style={styles.docIconWrapper}>
                      <Ionicons
                        name="document-text"
                        size={24}
                        color="#94A3B8"
                      />
                    </View>
                    <View style={styles.docTextWrapper}>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text style={styles.docTitle}>
                          {docItem.type || "Document"}
                        </Text>
                        {docItem.verified && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#10B981"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                      <Text style={styles.docSubtitle}>
                        {docItem.type || "Uploaded Document"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.viewDocButton,
                        { flex: 1, backgroundColor: "#ECFDF5" },
                      ]}
                      onPress={() =>
                        downloadDocument(
                          docItem.url,
                          docItem.type || "Document",
                        )
                      }
                    >
                      <Text style={[styles.viewDocText, { color: "#059669" }]}>
                        Download
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          : null}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Document Modal */}
      <Modal visible={isDocModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Documents</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsDocModalVisible(false);
                  setPreviewDocUrl(null);
                }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: Spacing.md }}
            >
              {user?.documents && user.documents.length > 0 ? (
                user.documents.map((docItem, index) => (
                  <View
                    key={docItem.id || index.toString()}
                    style={styles.docSection}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <Text style={styles.docLabel}>
                        {docItem.type || "Document"}
                      </Text>
                      {docItem.verified && (
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#10B981"
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#10B981",
                              marginLeft: 4,
                              fontWeight: "600",
                            }}
                          >
                            Verified
                          </Text>
                        </View>
                      )}
                    </View>
                    {docItem.url && (
                      <View>
                        {docItem.name?.toLowerCase().endsWith(".pdf") ||
                        docItem.url.toLowerCase().includes(".pdf") ? (
                          <View
                            style={{
                              width: "100%",
                              borderRadius: 8,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: "#E2E8F0",
                              marginTop: 8,
                              backgroundColor: "#F8FAFC",
                            }}
                          >
                            {previewDocUrl === docItem.url ? (
                              <View style={{ height: 300, width: "100%" }}>
                                {Platform.OS === "web" ? (
                                  <iframe
                                    src={docItem.url}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      border: "none",
                                    }}
                                  />
                                ) : (
                                  <WebView
                                    source={{
                                      uri:
                                        Platform.OS === "android"
                                          ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(docItem.url)}`
                                          : docItem.url,
                                    }}
                                    style={{ flex: 1 }}
                                    startInLoadingState={true}
                                    renderLoading={() => (
                                      <ActivityIndicator
                                        size="small"
                                        color="#3B82F6"
                                        style={{
                                          position: "absolute",
                                          top: "50%",
                                          left: "50%",
                                          marginLeft: -10,
                                          marginTop: -10,
                                        }}
                                      />
                                    )}
                                  />
                                )}
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={{
                                  padding: 20,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                onPress={() => setPreviewDocUrl(docItem.url)}
                              >
                                <Ionicons
                                  name="eye-outline"
                                  size={32}
                                  color="#94A3B8"
                                />
                                <Text
                                  style={{
                                    color: "#64748B",
                                    marginTop: 8,
                                    fontWeight: "500",
                                  }}
                                >
                                  Tap to load PDF preview
                                </Text>
                                <Text
                                  style={{
                                    color: "#94A3B8",
                                    fontSize: 11,
                                    marginTop: 4,
                                    textAlign: "center",
                                  }}
                                >
                                  Loading all PDFs at once slows down the app
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <Image
                            source={{ uri: docItem.url }}
                            style={[styles.docImage, { marginTop: 8 }]}
                            resizeMode="contain"
                          />
                        )}
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 10,
                            marginTop: 8,
                          }}
                        >
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 10,
                              backgroundColor: "#EEF2FF",
                              borderRadius: 6,
                            }}
                            onPress={() => viewDocument(docItem.url)}
                          >
                            <Ionicons
                              name="eye-outline"
                              size={18}
                              color="#6366F1"
                            />
                            <Text
                              style={{
                                marginLeft: 6,
                                color: "#6366F1",
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              View
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 10,
                              backgroundColor: "#F0FDF4",
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: "#BBF7D0",
                            }}
                            onPress={() =>
                              downloadDocument(
                                docItem.url,
                                docItem.name || "document.pdf",
                              )
                            }
                          >
                            <Ionicons
                              name="download-outline"
                              size={18}
                              color="#16A34A"
                            />
                            <Text
                              style={{
                                marginLeft: 6,
                                color: "#16A34A",
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              Download
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <>
                  {user?.panCard && (
                    <View style={styles.docSection}>
                      <Text style={styles.docLabel}>PAN Card Number</Text>
                      <Text style={styles.docValue}>{user.panCard}</Text>
                      {user.panCardPhotoUrl && (
                        <Image
                          source={{ uri: user.panCardPhotoUrl }}
                          style={styles.docImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  )}

                  {user?.aadharCard && (
                    <View style={styles.docSection}>
                      <Text style={styles.docLabel}>Aadhar Card Number</Text>
                      <Text style={styles.docValue}>{user.aadharCard}</Text>

                      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                        {user.aadharCardPhotoUrl && (
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.docLabel,
                                { fontSize: 11, marginBottom: 2 },
                              ]}
                            >
                              Front Side
                            </Text>
                            <Image
                              source={{ uri: user.aadharCardPhotoUrl }}
                              style={[styles.docImage, { height: 120 }]}
                              resizeMode="contain"
                            />
                          </View>
                        )}
                        {user.aadharCardBackPhotoUrl && (
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.docLabel,
                                { fontSize: 11, marginBottom: 2 },
                              ]}
                            >
                              Back Side
                            </Text>
                            <Image
                              source={{ uri: user.aadharCardBackPhotoUrl }}
                              style={[styles.docImage, { height: 120 }]}
                              resizeMode="contain"
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Screen Viewer Modal */}
      <Modal
        visible={isFullViewerVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.closeImageBtn}
            onPress={() => {
              setIsFullViewerVisible(false);
              setFullViewerUrl(null);
              setIsDocModalVisible(true);
            }}
          >
            <Ionicons name="close-circle" size={36} color="#ffffff" />
          </TouchableOpacity>
          {fullViewerUrl &&
            (fullViewerUrl.toLowerCase().includes(".pdf") ? (
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  backgroundColor: "#fff",
                  marginTop: Platform.OS === "ios" ? 40 : 0,
                }}
              >
                {Platform.OS === "web" ? (
                  <iframe
                    src={fullViewerUrl}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <WebView
                    source={{
                      uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fullViewerUrl)}`,
                    }}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            ) : (
              <Image
                source={{ uri: fullViewerUrl }}
                style={{ width: "100%", height: "80%" }}
                resizeMode="contain"
              />
            ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "#FAFAFA",
  },
  iconBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6366F1",
  },
  scrollContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  topSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  gradientCard: {
    width: "100%",
    height: 110,
    borderRadius: 24,
  },
  avatarWrapper: {
    marginTop: -50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EFF6FF",
    borderWidth: 4,
    borderColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "bold",
    color: Colors.primary,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#FF6B6B",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FAFAFA",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  sectionContent: {
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  infoIconWrapper: {
    width: 32,
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1E293B",
  },
  docHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  docIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docTextWrapper: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  docSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  viewDocButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
  },
  viewDocText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#FF6B6B",
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
    elevation: 3,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  // Modals Styles
  imageViewerOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    ...(StyleSheet.absoluteFill as any),
    zIndex: 9999,
  },
  closeImageBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 20,
    zIndex: 10000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: "#F8FAFC",
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
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  docImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    marginTop: Spacing.xs,
  },
});
