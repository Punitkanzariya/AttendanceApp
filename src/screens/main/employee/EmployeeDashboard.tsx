import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { Image } from "react-native";
import GradientHeader from "@/components/shared/GradientHeader";
import AnimatedSuccessModal from "@/components/shared/AnimatedSuccessModal";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { EmployeeTabParamList, AttendanceRecord } from "@/types";
import { subscribeToTodayAttendance, checkInEmployee, checkOutEmployee } from "@/firebase";
import { useLiveWorkingHours } from "@/hooks/useLiveWorkingHours";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

async function getShortAddress(latitude: number, longitude: number): Promise<string> {
  let address = '';
  // 1. Try Native Geocoder
  try {
    const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geocode && geocode.length > 0) {
      const item = geocode[0];
      address = [item.name, item.street, item.district, item.city, item.postalCode]
        .filter(Boolean)
        .join(', ');
    }
  } catch (err) {
    console.warn('Native geocoding failed, trying fallback...', err);
  }

  // 2. Try OpenStreetMap Nominatim Fallback
  if (!address) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            'User-Agent': 'AttendanceApp/1.0',
          },
        }
      );
      const data = await response.json();
      if (data && data.address) {
        const road = data.address.road || data.address.street || data.address.pedestrian;
        const suburb = data.address.suburb || data.address.neighbourhood || data.address.city_district;
        const city = data.address.city || data.address.town || data.address.village || data.address.county;
        const postcode = data.address.postcode;
        
        address = [road, suburb, city, postcode]
          .filter(Boolean)
          .join(', ');
      }
      if (!address && data && data.display_name) {
        address = data.display_name;
      }
    } catch (fallbackErr) {
      console.warn('Fallback geocoding failed:', fallbackErr);
    }
  }

  // 3. Absolute Fallback to coordinates
  if (!address) {
    address = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
  }

  return address;
}

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  // const navigation = useNavigation<any>();
  const navigation =
    useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isClocking, setIsClocking] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("Fetching location...");
  const [currentLocationCoords, setCurrentLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Subscribe to today's attendance
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToTodayAttendance(user.uid, user.role, (record) => {
      setTodayRecord(record);
    });
  }, [user?.uid]);

  // Fetch location on mount
  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentAddress('Location Permission Denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocationCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      
      const address = await getShortAddress(loc.coords.latitude, loc.coords.longitude);
      setCurrentAddress(address);
    } catch (err) {
      console.warn(err);
      setCurrentAddress('Failed to get location');
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLocation();
    setRefreshing(false);
  }, [fetchLocation]);

  const handleClockAction = async () => {
    if (isClocking) return;
    setIsClocking(true);

    try {
      // 1. Request location permissions and get position
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to clock in/out.');
        setIsClocking(false);
        return;
      }

      // 2. Request camera permissions
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to capture a verification selfie.');
        setIsClocking(false);
        return;
      }

      // 3. Start fetching fresh location in the background BEFORE opening the camera
      // This ensures 100% accuracy but 0 wait time, since GPS runs while user poses!
      const locationPromise = (async () => {
        try {
          const freshLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const newAddress = await getShortAddress(freshLoc.coords.latitude, freshLoc.coords.longitude);
          return {
            latitude: freshLoc.coords.latitude,
            longitude: freshLoc.coords.longitude,
            address: newAddress,
          };
        } catch (err) {
          // Fallback to cached only if fresh fetch fails completely
          if (currentLocationCoords && currentAddress && currentAddress !== "Fetching location...") {
            return {
              latitude: currentLocationCoords.latitude,
              longitude: currentLocationCoords.longitude,
              address: currentAddress,
            };
          }
          throw err;
        }
      })();

      // 4. Capture selfie (While this is open, the background GPS is finishing up!)
      const cameraResult = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.4,
      });

      if (cameraResult.canceled || !cameraResult.assets || cameraResult.assets.length === 0) {
        Alert.alert('Action Canceled', 'Selfie verification is required to clock in/out.');
        setIsClocking(false);
        return;
      }

      const selfieUri = cameraResult.assets[0].uri;

      // 5. Await the location promise. By the time the camera is closed, this will already be 100% done!
      const attendanceLoc = await locationPromise;

      if (!todayRecord) {
        // Clock In
        await checkInEmployee(
          user.uid,
          user.role,
          user!.displayName || 'Employee',
          attendanceLoc,
          '',
          selfieUri,
          user!.username
        );
        setSuccessMessage('Successfully Clocked In');
        setSuccessModalVisible(true);
      } else if (!todayRecord.checkOut) {
        // Clock Out
        await checkOutEmployee(
          user!.uid,
          user.role,
          attendanceLoc,
          '',
          selfieUri
        );
        setSuccessMessage('Successfully Clocked Out');
        setSuccessModalVisible(true);
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'An error occurred while registering attendance');
    } finally {
      setIsClocking(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "--";
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkingHoursText = () => useLiveWorkingHours(todayRecord);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AnimatedSuccessModal 
        visible={successModalVisible} 
        message={successMessage} 
        onClose={() => setSuccessModalVisible(false)} 
      />
      <View style={styles.root}>
        <GradientHeader />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2E7D32"]}
              tintColor="#2E7D32"
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.locationContainer}>
              <View style={styles.locationIconWrap}>
                <Ionicons
                  name="location"
                  size={20}
                  color={Colors.text.secondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabelTxt}>LOCATION</Text>
                <Text style={styles.dateText} numberOfLines={2} ellipsizeMode="tail">
                  {currentAddress}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.bellBtn}
                activeOpacity={0.7}
                onPress={() => (navigation as any).navigate("Notifications")}
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={Colors.text.primary}
                />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <View style={styles.avatarWrap}>
                {user?.photoURL ? (
                  <Image source={{ uri: user.photoURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {user?.displayName
                      ? user.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()
                      : "EM"}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.pageTitle}>
            Welcome,{user?.displayName ?? "User"}
          </Text>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Clock In</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(todayRecord?.checkIn?.timestamp)}
                </Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Clock Out</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(todayRecord?.checkOut?.timestamp)}
                </Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Working Hours</Text>
                <Text style={styles.summaryValue}>{getWorkingHoursText()}</Text>
              </View>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: Colors.border,
                marginVertical: 4,
              }}
            />
            <View style={{ alignItems: "center" }}>
              <TouchableOpacity
                style={[
                  styles.clockBtn,
                  { paddingHorizontal: 40 },
                  todayRecord &&
                    !todayRecord.checkOut && {
                      backgroundColor: Colors.error,
                    },
                  todayRecord?.checkIn &&
                    todayRecord?.checkOut && {
                      backgroundColor: Colors.text.tertiary,
                    },
                  isClocking && {
                    opacity: 0.6,
                  }
                ]}
                activeOpacity={0.8}
                onPress={handleClockAction}
                disabled={isClocking || !!(todayRecord?.checkIn && todayRecord?.checkOut)}
              >
                <Text style={styles.clockBtnTxt}>
                  {isClocking ? "Processing..." : (
                    !todayRecord
                      ? "Clock In"
                      : !todayRecord.checkOut
                        ? "Clock Out"
                        : "Completed"
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickBtn} 
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate('Leave')}
            >
              <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              <Text style={styles.quickBtnTxt}>Apply leave</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickBtn} 
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate('Expenses')}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#2563EB"
              />
              <Text style={styles.quickBtnTxt}>Submit expense</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickBtn} 
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate('Attendance')}
            >
              <Ionicons name="time-outline" size={20} color="#2563EB" />
              <Text style={styles.quickBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>

          {/* Attendance for this Month */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendance for this Month</Text>
            <TouchableOpacity style={styles.monthBtn} activeOpacity={0.7}>
              <Text style={styles.monthBtnTxt}>APR</Text>
              <Ionicons name="calendar-outline" size={12} color="#2563EB" />
            </TouchableOpacity>
          </View>
          <View style={styles.attendanceGrid}>
            <View
              style={[
                styles.attCard,
                { backgroundColor: "#E8F5E9", borderTopColor: "#2E7D32" },
              ]}
            >
              <Text style={styles.attLabel}>Present</Text>
              <Text style={[styles.attNum, { color: "#2E7D32" }]}>13</Text>
            </View>
            <View
              style={[
                styles.attCard,
                { backgroundColor: "#FFEBEE", borderTopColor: "#C62828" },
              ]}
            >
              <Text style={styles.attLabel}>Absents</Text>
              <Text style={[styles.attNum, { color: "#C62828" }]}>02</Text>
            </View>
            <View
              style={[
                styles.attCard,
                { backgroundColor: "#FFF8E1", borderTopColor: "#F9A825" },
              ]}
            >
              <Text style={styles.attLabel}>Late in</Text>
              <Text style={[styles.attNum, { color: "#F9A825" }]}>04</Text>
            </View>
          </View>

          {/* Leave Balance */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
          </View>
          <View style={styles.leaveGrid}>
            <View style={styles.leaveRow}>
              <View style={styles.leaveCard}>
                <View
                  style={[styles.leaveIconRing, { borderColor: "#2E7D32" }]}
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={16}
                    color={Colors.text.primary}
                  />
                </View>
                <View>
                  <Text style={styles.leaveNum}>
                    12 <Text style={styles.leaveTotalTxt}>/ 15 Days</Text>
                  </Text>
                  <Text style={styles.leaveLabel}>Paid Leave</Text>
                  <Text style={styles.leaveTakenTxt}>3 Taken</Text>
                </View>
              </View>
              <View style={styles.leaveCard}>
                <View
                  style={[styles.leaveIconRing, { borderColor: "#2563EB" }]}
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={16}
                    color={Colors.text.primary}
                  />
                </View>
                <View>
                  <Text style={styles.leaveNum}>
                    7 <Text style={styles.leaveTotalTxt}>/ 10 Days</Text>
                  </Text>
                  <Text style={styles.leaveLabel}>Sick Leave</Text>
                  <Text style={styles.leaveTakenTxt}>3 Taken</Text>
                </View>
              </View>
            </View>
            <View style={styles.leaveRow}>
              <View style={styles.leaveCard}>
                <View
                  style={[styles.leaveIconRing, { borderColor: "#F59E0B" }]}
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={16}
                    color={Colors.text.primary}
                  />
                </View>
                <View>
                  <Text style={styles.leaveNum}>
                    5 <Text style={styles.leaveTotalTxt}>/ 8 Days</Text>
                  </Text>
                  <Text style={styles.leaveLabel}>Casual Leave</Text>
                  <Text style={styles.leaveTakenTxt}>3 Taken</Text>
                </View>
              </View>
              <View style={styles.leaveCard}>
                <View
                  style={[styles.leaveIconRing, { borderColor: "#8B5CF6" }]}
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={16}
                    color={Colors.text.primary}
                  />
                </View>
                <View>
                  <Text style={styles.leaveNum}>
                    24 <Text style={styles.leaveTotalTxt}>/ 33 Days</Text>
                  </Text>
                  <Text style={styles.leaveLabel}>Total Leave</Text>
                  <Text style={styles.leaveTakenTxt}>9 Taken</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#BFDBFE" },
  root: { flex: 1, backgroundColor: Colors.employeeBg },
  container: { padding: 10, paddingBottom: Spacing.xxl },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabelTxt: {
    fontSize: 10,
    color: Colors.text.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateText: { fontSize: 13, color: Colors.text.primary, fontWeight: "600" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: Colors.white, fontSize: 12, fontWeight: "700" },

  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    lineHeight: 34,
    marginBottom: 10,
  },

  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryCol: { flex: 1 },
  summaryLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: "500",
    marginBottom: 4,
  },
  summaryValue: { fontSize: 15, fontWeight: "600", color: Colors.text.primary },
  clockBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
  },
  clockBtnTxt: { color: Colors.white, fontWeight: "600", fontSize: 13 },

  quickActionsContainer: { flexDirection: "row", gap: 10, marginBottom: 20 },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
    shadowColor: "#0000004f",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  quickBtnTxt: {
    color: Colors.text.primary,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },
  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  monthBtnTxt: { color: "#2563EB", fontSize: 11, fontWeight: "600" },

  attendanceGrid: { flexDirection: "row", gap: Spacing.sm, marginBottom: 20 },
  attCard: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 75,
    justifyContent: "space-between",
  },
  attLabel: { fontSize: 11, color: Colors.text.primary, fontWeight: "600" },
  attNum: { fontSize: 18, fontWeight: "700", alignSelf: "flex-end" },

  leaveGrid: { flexDirection: "column", gap: Spacing.sm, marginBottom: 40 },
  leaveRow: { flexDirection: "row", gap: Spacing.sm },
  leaveCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaveIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 2,
  },
  leaveTotalTxt: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: "500",
  },
  leaveLabel: { fontSize: 10, color: Colors.text.secondary },
  leaveTakenTxt: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
});
