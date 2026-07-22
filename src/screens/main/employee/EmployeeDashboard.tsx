import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, FontSize } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import { Image } from "react-native";
import GradientHeader from "@/components/shared/GradientHeader";
import AnimatedSuccessModal from "@/components/shared/AnimatedSuccessModal";
import { BirthdayModal } from "@/components/shared/BirthdayModal";
import LeaveBalanceBoxes from "@/components/shared/LeaveBalanceBoxes";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { EmployeeTabParamList, AttendanceRecord } from "@/types";
import {
  db,
  subscribeToTodayAttendance,
  checkInEmployee,
  checkOutEmployee,
  subscribeToUserAttendanceHistory,
  logFailedGeofenceAttempt,
  markMissedCheckouts,
} from "@/firebase";
import { logAuditAction } from "@/firebase/auditService";
import { doc, collection, setDoc } from "firebase/firestore";
import { getEmployeeActiveProject } from "@/firebase/projectService";
import {
  subscribeToUserLeaves,
  subscribeToUserLeaveBalance,
} from "@/firebase/leaveService";
import type { LeaveRequest, LeaveType } from "@/types";
import MonthPickerModal from "@/components/shared/MonthPickerModal";
import { useLiveWorkingHours } from "@/hooks/useLiveWorkingHours";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { calculateDistanceMeters } from "@/utils/locationUtils";
import GeoFenceMap from "@/components/shared/GeoFenceMap";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getShortAddress(
  latitude: number,
  longitude: number,
): Promise<string> {
  let address = "";
  // Helper for timeout
  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  }

  // 1. Try Native Geocoder with 2.5s timeout
  try {
    const geocode = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      2500,
    );
    if (geocode && geocode.length > 0) {
      const item = geocode[0];
      address = [
        item.name,
        item.street,
        item.district,
        item.city,
        item.postalCode,
      ]
        .filter(Boolean)
        .join(", ");
    }
  } catch (err) {
    console.warn("Native geocoding failed", err);
  }

  // 2. Try OpenStreetMap Nominatim Fallback with 2.5s timeout
  if (!address) {
    try {
      const fetchPromise = fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        { headers: { "User-Agent": "AttendanceApp/1.0" } },
      );
      const response = await withTimeout(fetchPromise, 2500);

      if (response && response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const road =
            data.address.road || data.address.street || data.address.pedestrian;
          const suburb =
            data.address.suburb ||
            data.address.neighbourhood ||
            data.address.city_district;
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county;
          address = [road, suburb, city].filter(Boolean).join(", ");
        }
        if (!address && data && data.display_name) {
          address = data.display_name;
        }
      }
    } catch (fallbackErr) {
      console.warn("Fallback geocoding failed:", fallbackErr);
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
  const hasUnreadNotifications = useUnreadNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.log("Notification permissions not granted");
        }
      }
    })();
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isMonthPickerVisible, setMonthPickerVisible] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("Fetching location...");
  const [currentLocationCoords, setCurrentLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [geofenceViolationData, setGeofenceViolationData] = useState<any>(null);

  const [leaves, setLeaves] = useState<any[]>([]);
  const [userLeaveBalance, setUserLeaveBalance] = useState<any>(null);
  const [isLeavesLoading, setIsLeavesLoading] = useState(true);

  const [activeProject, setActiveProject] = useState<any>(null);

  useEffect(() => {
    if (user?.uid && user?.projectId) {
      getEmployeeActiveProject(user.uid, user.projectId).then((proj) => {
        if (proj) {
          setActiveProject(proj);
        }
      });
    }
  }, [user]);

  // Subscribe to today's attendance and history
  useEffect(() => {
    if (!user?.uid) return;
    const shiftStart = activeProject?.workingHours?.start;
    const shiftEnd = activeProject?.workingHours?.end;

    const unsubToday = subscribeToTodayAttendance(
      user.uid,
      user.role,
      (record) => {
        setTodayRecord(record);
        setIsAttendanceLoading(false);
      },
      shiftStart,
      shiftEnd,
    );

    const unsubHistory = subscribeToUserAttendanceHistory(
      user.uid,
      (records) => {
        setHistory(records);
        markMissedCheckouts(user.uid, records, shiftStart, shiftEnd);
      },
    );

    return () => {
      unsubToday();
      unsubHistory();
    };
  }, [
    user?.uid,
    activeProject?.workingHours?.start,
    activeProject?.workingHours?.end,
  ]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubLeaves = subscribeToUserLeaves(user.uid, user.role, (data) => {
      setLeaves(data);
      setIsLeavesLoading(false);
    });

    const currentYear = new Date().getFullYear();
    const unsubBalance = subscribeToUserLeaveBalance(
      user.uid,
      currentYear,
      (data: any) => {
        setUserLeaveBalance(data);
      },
    );

    return () => {
      unsubLeaves();
      unsubBalance();
    };
  }, [user?.uid]);

  // Fetch location on mount
  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setCurrentAddress("Location Permission Denied");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocationCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const address = await getShortAddress(
        loc.coords.latitude,
        loc.coords.longitude,
      );
      setCurrentAddress(address);
    } catch (err) {
      console.warn(err);
      setCurrentAddress("Failed to get location");
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
    if (!user) return;
    if (isClocking) return;
    setIsClocking(true);

    // Helper: real timeout wrapper (Expo Location doesn't support timeout param!)
    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), ms),
        ),
      ]);
    }

    try {
      // 1. Request BOTH permissions in parallel
      const [locPerm, camPerm] = await Promise.all([
        Location.requestForegroundPermissionsAsync(),
        ImagePicker.requestCameraPermissionsAsync(),
      ]);

      if (locPerm.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Location permission is required to check in/out.",
        );
        setIsClocking(false);
        return;
      }
      if (camPerm.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to capture a verification selfie.",
        );
        setIsClocking(false);
        return;
      }

      // 2. Fetch cached location + fetch project if not already available
      let currentActiveProject = activeProject;
      const promises: any[] = [Location.getLastKnownPositionAsync()];
      if (!currentActiveProject) {
        promises.push(getEmployeeActiveProject(user.uid, user.projectId));
      }
      const results = await Promise.all(promises);
      const lastKnownLoc = results[0];
      if (!currentActiveProject) {
        currentActiveProject = results[1];
        setActiveProject(currentActiveProject);
      }

      // 3. Geofence validation helper (pure math, instant)
      const validateGeofence = (lat: number, lng: number) => {
        if (
          !currentActiveProject?.isGeofenceEnabled ||
          !currentActiveProject.location?.latitude ||
          !currentActiveProject.location?.longitude
        )
          return true;
        const distance = calculateDistanceMeters(
          lat,
          lng,
          currentActiveProject.location.latitude,
          currentActiveProject.location.longitude,
        );
        const radius = currentActiveProject.geofenceRadius || 200;
        if (distance > radius) return { distance, radius, failed: true };
        return true;
      };

      const showViolation = async (
        userLat: number,
        userLng: number,
        distance: number,
        radius: number,
      ) => {
        setGeofenceViolationData({
          type: "GEO_FENCE_VIOLATION",
          distance: Math.round(distance),
          radius,
          userLat,
          userLng,
          siteLat: currentActiveProject!.location!.latitude,
          siteLng: currentActiveProject!.location!.longitude,
        });
        setIsClocking(false);

        const attemptAction = !todayRecord
          ? "Check In"
          : !todayRecord.checkOut
            ? "Check Out"
            : "Unknown";

        await logAuditAction({
          userId: user.uid,
          userEmail: user.email || "",
          userName: user.displayName || "Unknown",
          userRole: user.role || "employee",
          module: "attendance",
          action: "GEOFENCE_FAILED",
          description: `Geofence violation during ${attemptAction}. Distance: ${Math.round(distance)}m`,
          severity: "medium",
        });

        if (user.projectId) {
          await logFailedGeofenceAttempt(
            user.uid,
            user.displayName || user.email || "Unknown",
            user.projectId,
            attemptAction,
            distance,
          );
        }
      };

      // 4. Determine location
      let useLoc: { latitude: number; longitude: number } | null = null;

      if (lastKnownLoc) {
        const geoResult = validateGeofence(
          lastKnownLoc.coords.latitude,
          lastKnownLoc.coords.longitude,
        );
        if (geoResult === true) {
          // Cached location is inside geofence — use it instantly!
          useLoc = {
            latitude: lastKnownLoc.coords.latitude,
            longitude: lastKnownLoc.coords.longitude,
          };
        } else if (typeof geoResult === "object" && geoResult.failed) {
          // Cached location is OUTSIDE geofence — try fresh GPS with strict 4s timeout
          try {
            const freshLoc = await withTimeout(
              Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Low,
              }),
              4000,
            );
            const freshResult = validateGeofence(
              freshLoc.coords.latitude,
              freshLoc.coords.longitude,
            );
            if (freshResult === true) {
              useLoc = {
                latitude: freshLoc.coords.latitude,
                longitude: freshLoc.coords.longitude,
              };
            } else if (typeof freshResult === "object" && freshResult.failed) {
              showViolation(
                freshLoc.coords.latitude,
                freshLoc.coords.longitude,
                freshResult.distance,
                freshResult.radius,
              );
              return;
            }
          } catch {
            // GPS timed out — show violation with the cached coords we already have
            showViolation(
              lastKnownLoc.coords.latitude,
              lastKnownLoc.coords.longitude,
              geoResult.distance,
              geoResult.radius,
            );
            return;
          }
        }
      }

      // 5. No cached location at all — must fetch fresh
      if (!useLoc) {
        try {
          const freshLoc = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            }),
            4000,
          );
          const geoResult = validateGeofence(
            freshLoc.coords.latitude,
            freshLoc.coords.longitude,
          );
          if (typeof geoResult === "object" && geoResult.failed) {
            showViolation(
              freshLoc.coords.latitude,
              freshLoc.coords.longitude,
              geoResult.distance,
              geoResult.radius,
            );
            return;
          }
          useLoc = {
            latitude: freshLoc.coords.latitude,
            longitude: freshLoc.coords.longitude,
          };
        } catch {
          // Fresh GPS also failed — try dashboard cached coords
          if (
            currentLocationCoords &&
            currentAddress &&
            currentAddress !== "Fetching location..."
          ) {
            const geoResult = validateGeofence(
              currentLocationCoords.latitude,
              currentLocationCoords.longitude,
            );
            if (typeof geoResult === "object" && geoResult.failed) {
              showViolation(
                currentLocationCoords.latitude,
                currentLocationCoords.longitude,
                geoResult.distance,
                geoResult.radius,
              );
              return;
            }
            useLoc = {
              latitude: currentLocationCoords.latitude,
              longitude: currentLocationCoords.longitude,
            };
          } else {
            Alert.alert(
              "Location Error",
              "Unable to determine your location. Please try again.",
            );
            setIsClocking(false);
            return;
          }
        }
      }

      // 6. Use cached address or GPS coords (don't block on reverse geocoding)
      let address =
        currentAddress && currentAddress !== "Fetching location..."
          ? currentAddress
          : "";
      if (!address) {
        address = `Lat: ${useLoc.latitude.toFixed(4)}, Lon: ${useLoc.longitude.toFixed(4)}`;
        getShortAddress(useLoc.latitude, useLoc.longitude)
          .then((addr) => {
            if (addr) setCurrentAddress(addr);
          })
          .catch(() => {});
      }

      const attendanceLoc = {
        latitude: useLoc.latitude,
        longitude: useLoc.longitude,
        address,
      };

      // 7. Capture selfie
      const cameraResult = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.3,
      });

      if (
        cameraResult.canceled ||
        !cameraResult.assets ||
        cameraResult.assets.length === 0
      ) {
        Alert.alert(
          "Action Canceled",
          "Selfie verification is required to check in/out.",
        );
        setIsClocking(false);
        return;
      }

      const selfieUri = cameraResult.assets[0].uri;

      // 8. Execute Check In/Out
      if (!todayRecord) {
        const {
          start: shiftStart,
          end: shiftEnd,
          name: shiftName,
        } = getActiveShiftDetails();

        await checkInEmployee(
          user.uid,
          attendanceLoc,
          "",
          selfieUri,
          user.email,
          shiftStart,
          shiftEnd,
          shiftName,
        );

        await logAuditAction({
          userId: user.uid,
          userEmail: user.email || "",
          userName: user.displayName || "Unknown",
          userRole: user.role || "employee",
          module: "attendance",
          action: "CHECK_IN",
          description: `Clocked In at ${attendanceLoc?.latitude}, ${attendanceLoc?.longitude}`,
          severity: "low",
        });

        setSuccessMessage("Successfully Checked In");
        setSuccessModalVisible(true);

        // Schedule checkout reminder
        if (shiftEnd && Platform.OS !== "web") {
          const [endH, endM] = shiftEnd.split(":").map(Number);
          const triggerDate = new Date();
          triggerDate.setHours(endH + 1, endM, 0, 0); // 1 hour after shift ends

          if (triggerDate > new Date()) {
            const notifId = await Notifications.scheduleNotificationAsync({
              content: {
                title: "Check Out Reminder ⏰",
                body: "Your shift ended an hour ago. Do not forget to Check Out for today!",
                sound: true,
              },
              trigger: { type: "date", date: triggerDate } as any,
            });
            await AsyncStorage.setItem("@checkout_reminder_id", notifId);
          }
        }
      } else if (!todayRecord.checkOut) {
        const { start: shiftStartCO, end: shiftEndCO } =
          getActiveShiftDetails();
        await checkOutEmployee(
          user!.uid,
          attendanceLoc,
          "",
          selfieUri,
          shiftStartCO,
          shiftEndCO,
        );

        await logAuditAction({
          userId: user!.uid,
          userEmail: user!.email || "",
          userName: user!.displayName || "Unknown",
          userRole: user!.role || "employee",
          module: "attendance",
          action: "CHECK_OUT",
          description: `Clocked Out at ${attendanceLoc?.latitude}, ${attendanceLoc?.longitude}`,
          metadata: {
            changedFields: ["checkOut"],
          },
          severity: "low",
        });

        setSuccessMessage("Successfully Checked Out");
        setSuccessModalVisible(true);

        // Cancel scheduled reminder if it exists
        try {
          const notifId = await AsyncStorage.getItem("@checkout_reminder_id");
          if (notifId) {
            await Notifications.cancelScheduledNotificationAsync(notifId);
            await AsyncStorage.removeItem("@checkout_reminder_id");
          }
        } catch (e) {
          console.log("Failed to cancel reminder", e);
        }
      }
    } catch (err: any) {
      setIsClocking(false);
      console.error(err);
      Alert.alert("Error", err.message || "An error occurred");
    } finally {
      setIsClocking(false);
    }
  };

  const getActiveShiftDetails = () => {
    let start = activeProject?.workingHours?.start;
    let end = activeProject?.workingHours?.end;
    let name = "General Shift";

    if (user?.currentShiftId && activeProject?.availableShifts) {
      const matched = activeProject.availableShifts.find(
        (s: any) => s.id === user.currentShiftId,
      );
      if (matched) {
        start = matched.startTime;
        end = matched.endTime;
        name = matched.name;
      }
    }

    if (start && end && name === "General Shift") {
      const [startH] = start.split(":").map(Number);
      const [endH] = end.split(":").map(Number);
      name = startH > endH ? "Night Shift" : "Day Shift";
    }

    return { start, end, name };
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "--";
    return new Date(isoString)
      .toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toUpperCase();
  };

  const formatHHMMtoAMPM = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const getExpectedCheckOut = () => {
    const { start: startStr, end: endStr } = getActiveShiftDetails();
    if (!startStr || !endStr) return null;
    if (!todayRecord?.checkIn?.timestamp) return formatHHMMtoAMPM(endStr);

    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);
    const isNightShift = startH > endH;

    let shiftStartMins = startH * 60 + startM;
    let shiftEndMins = endH * 60 + endM;
    if (isNightShift) shiftEndMins += 24 * 60;

    const durationMins = shiftEndMins - shiftStartMins;

    const checkInDate = new Date(todayRecord.checkIn.timestamp);
    let checkInMins = checkInDate.getHours() * 60 + checkInDate.getMinutes();

    if (isNightShift && checkInMins <= endH * 60 + endM) {
      checkInMins += 24 * 60;
    }

    if (checkInMins > shiftStartMins) {
      let outMins = checkInMins + durationMins;

      if (isNightShift) {
        if (outMins >= 2160) outMins = 2159; // Cap at 11:59 AM next day
      } else {
        if (outMins >= 1440) outMins = 1439; // Cap at 11:59 PM today
      }

      const outH = Math.floor(outMins / 60) % 24;
      const outM = outMins % 60;
      return formatHHMMtoAMPM(`${outH}:${outM}`);
    }
    return formatHHMMtoAMPM(endStr);
  };

  const workingHoursText = useLiveWorkingHours(todayRecord);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AnimatedSuccessModal
        visible={successModalVisible}
        message={successMessage}
        onClose={() => setSuccessModalVisible(false)}
      />
      <BirthdayModal user={user} />
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
                <Text
                  style={styles.dateText}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
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
                {hasUnreadNotifications && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarWrap}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate("Profile")}
              >
                {user?.profilePicture ? (
                  <Image
                    source={{ uri: user.profilePicture }}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                  />
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
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.pageTitle}>
            Welcome,{user?.displayName ?? "User"}
          </Text>

          {/* Summary Card */}
          {(() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const todayLeave = leaves.find(
              (l) =>
                l.status === "approved" &&
                l.startDate <= todayStr &&
                l.endDate >= todayStr,
            );

            const {
              start: shiftStart,
              end: shiftEnd,
              name,
            } = getActiveShiftDetails();
            let shiftName = name;
            let cutOffTime = "12:00 AM (Midnight)";

            if (shiftStart && shiftEnd) {
              const startH = Number(shiftStart.split(":")[0]);
              const endH = Number(shiftEnd.split(":")[0]);
              if (startH > endH) cutOffTime = "12:00 PM (Noon)";
            }

            if (todayRecord?.shift?.name) shiftName = todayRecord.shift.name;
            if (todayRecord?.shift?.startTime) {
              const sH = Number(todayRecord.shift.startTime.split(":")[0]);
              const eH = Number(todayRecord.shift.endTime.split(":")[0]);
              if (sH > eH) cutOffTime = "12:00 PM (Noon)";
              else cutOffTime = "12:00 AM (Midnight)";
            }

            const isNight = shiftName.includes("Night");
            const shiftColor = isNight ? "#4F46E5" : Colors.primary;

            return (
              <View style={styles.summaryCard}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.border,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name={isNight ? "moon" : "sunny"}
                      size={16}
                      color={shiftColor}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: shiftColor,
                        fontWeight: "bold",
                      }}
                    >
                      {shiftName}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryTopRow}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Check In</Text>
                    <Text style={styles.summaryValue}>
                      {todayRecord?.checkIn?.timestamp
                        ? formatTime(todayRecord.checkIn.timestamp)
                        : "--"}
                    </Text>
                    {todayRecord?.status === "late" && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: Colors.error,
                          marginTop: 2,
                          fontWeight: "bold",
                        }}
                      >
                        (Late)
                      </Text>
                    )}
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Check Out</Text>
                    <Text style={styles.summaryValue}>
                      {todayRecord?.checkOut?.timestamp
                        ? formatTime(todayRecord.checkOut.timestamp)
                        : "--"}
                    </Text>
                    {getExpectedCheckOut() &&
                      todayRecord?.checkIn?.timestamp &&
                      !todayRecord?.checkOut?.timestamp && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: Colors.text.secondary,
                            marginTop: 2,
                          }}
                        >
                          (Exp: {getExpectedCheckOut()})
                        </Text>
                      )}
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Working Hours</Text>
                    <Text style={styles.summaryValue}>{workingHoursText}</Text>
                  </View>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: Colors.border,
                    marginVertical: 4,
                  }}
                />
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                  {todayLeave &&
                  todayLeave.durationType !== "half_day" &&
                  !todayRecord ? (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#6D28D9",
                      }}
                    >
                      You are on leave today
                    </Text>
                  ) : (
                    <View style={{ width: "100%", alignItems: "center" }}>
                      {todayLeave && todayLeave.durationType === "half_day" && (
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#6D28D9",
                            marginBottom: 12,
                          }}
                        >
                          On Half Day Leave (
                          {todayLeave.halfDayPeriod === "first_half"
                            ? "1st Half"
                            : "2nd Half"}
                          )
                        </Text>
                      )}
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
                          (isClocking || isAttendanceLoading) && {
                            opacity: 0.6,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={handleClockAction}
                        disabled={
                          isAttendanceLoading ||
                          isClocking ||
                          !!(todayRecord?.checkIn && todayRecord?.checkOut)
                        }
                      >
                        {isAttendanceLoading || isClocking ? (
                          <ActivityIndicator color={Colors.white} />
                        ) : (
                          <Text style={styles.clockBtnTxt}>
                            {!todayRecord
                              ? "Check In"
                              : !todayRecord.checkOut
                                ? "Check Out"
                                : "Completed"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={styles.quickBtn}
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate("Leave")}
            >
              <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              <Text style={styles.quickBtnTxt}>Apply leave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate("Expenses")}
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
              onPress={() => (navigation as any).navigate("Attendance")}
            >
              <Ionicons name="time-outline" size={20} color="#2563EB" />
              <Text style={styles.quickBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>

          {/* Attendance for this Month */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendance for this Month</Text>
            <TouchableOpacity
              style={styles.monthBtn}
              activeOpacity={0.7}
              onPress={() => setMonthPickerVisible(true)}
            >
              <Text style={styles.monthBtnTxt}>
                {selectedMonth
                  .toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </Text>
              <Ionicons name="calendar-outline" size={12} color="#2563EB" />
            </TouchableOpacity>
          </View>
          <View style={styles.attendanceGrid}>
            {(() => {
              const now = selectedMonth;
              const actualToday = new Date();
              const isCurrentMonth =
                now.getMonth() === actualToday.getMonth() &&
                now.getFullYear() === actualToday.getFullYear();
              const isFutureMonth =
                now.getFullYear() > actualToday.getFullYear() ||
                (now.getFullYear() === actualToday.getFullYear() &&
                  now.getMonth() > actualToday.getMonth());

              const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

              const currentMonthRecords = history.filter((r) =>
                r.dateStr.startsWith(currentMonthStr),
              );
              if (
                todayRecord &&
                todayRecord.dateStr.startsWith(currentMonthStr)
              ) {
                // Ensure today's record is included if not in history yet
                if (!currentMonthRecords.find((r) => r.id === todayRecord.id)) {
                  currentMonthRecords.push(todayRecord);
                }
              }

              const presentCount = currentMonthRecords.length;

              let lateCount = 0;
              currentMonthRecords.forEach((r) => {
                if (r.status === "late") {
                  lateCount++;
                }
              });

              let absentCount = 0;
              let todayDay = 0;

              if (isFutureMonth) {
                todayDay = 0;
              } else if (isCurrentMonth) {
                todayDay = actualToday.getDate();
              } else {
                // Past month, get all days in the month
                todayDay = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  0,
                ).getDate();
              }

              let missingDays = 0;
              for (let i = 1; i <= todayDay; i++) {
                const d = new Date(now.getFullYear(), now.getMonth(), i);
                if (d.getDay() !== 0) {
                  // Not Sunday
                  const dStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
                  const hasRecord = currentMonthRecords.some(
                    (r) => r.dateStr === dStr,
                  );

                  // Check if on approved leave
                  const isOnLeave = leaves.some(
                    (l) =>
                      l.status === "approved" &&
                      l.startDate <= dStr &&
                      l.endDate >= dStr,
                  );

                  if (!hasRecord && !isOnLeave) {
                    missingDays++;
                  }
                }
              }
              absentCount = missingDays;

              return (
                <>
                  <View
                    style={[
                      styles.attCard,
                      { backgroundColor: "#E8F5E9", borderTopColor: "#2E7D32" },
                    ]}
                  >
                    <Text style={styles.attLabel}>Present</Text>
                    <Text style={[styles.attNum, { color: "#2E7D32" }]}>
                      {String(presentCount).padStart(2, "0")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.attCard,
                      { backgroundColor: "#FFEBEE", borderTopColor: "#C62828" },
                    ]}
                  >
                    <Text style={styles.attLabel}>Absents</Text>
                    <Text style={[styles.attNum, { color: "#C62828" }]}>
                      {String(absentCount).padStart(2, "0")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.attCard,
                      { backgroundColor: "#FFF8E1", borderTopColor: "#F9A825" },
                    ]}
                  >
                    <Text style={styles.attLabel}>Late in</Text>
                    <Text style={[styles.attNum, { color: "#F9A825" }]}>
                      {String(lateCount).padStart(2, "0")}
                    </Text>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Leave Balance */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
          </View>
          <LeaveBalanceBoxes
            userLeaveBalance={userLeaveBalance}
            isLoading={isLeavesLoading}
            leaves={leaves}
            user={user}
          />
        </ScrollView>
      </View>

      {/* Geofence Violation Modal */}
      <Modal
        visible={!!geofenceViolationData}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="warning" size={28} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Out of Range</Text>
            </View>

            <Text style={styles.modalDesc}>
              You are{" "}
              <Text style={{ fontWeight: "bold", color: "#EF4444" }}>
                {geofenceViolationData?.distance > 1000
                  ? `${(geofenceViolationData.distance / 1000).toFixed(1)} km`
                  : `${geofenceViolationData?.distance} meters`}
              </Text>{" "}
              away from the site. You must be within{" "}
              <Text style={{ fontWeight: "bold" }}>
                {geofenceViolationData?.radius > 1000
                  ? `${(geofenceViolationData.radius / 1000).toFixed(1)} km`
                  : `${geofenceViolationData?.radius} meters`}
              </Text>{" "}
              to{" "}
              {!todayRecord || todayRecord.checkOut ? "Check In" : "Check Out"}.
            </Text>

            {geofenceViolationData && (
              <View
                style={{
                  height: 250,
                  width: "100%",
                  marginVertical: 15,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <GeoFenceMap
                  latitude={geofenceViolationData.siteLat.toString()}
                  longitude={geofenceViolationData.siteLng.toString()}
                  radius={geofenceViolationData.radius.toString()}
                  userLatitude={geofenceViolationData.userLat.toString()}
                  userLongitude={geofenceViolationData.userLng.toString()}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setGeofenceViolationData(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MonthPickerModal
        visible={isMonthPickerVisible}
        selectedDate={selectedMonth}
        onClose={() => setMonthPickerVisible(false)}
        onSelect={(date) => {
          setSelectedMonth(date);
          setMonthPickerVisible(false);
        }}
      />
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
  emptyStateSubtext: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: "bold",
    color: Colors.text.primary,
  },
  modalDesc: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
  modalBtn: {
    backgroundColor: "#0F172A",
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  modalBtnTxt: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: "bold",
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
