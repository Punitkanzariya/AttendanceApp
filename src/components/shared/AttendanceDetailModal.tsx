import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import { Colors, Spacing, BorderRadius } from '@/theme';
import type { AttendanceRecord, AttendanceLocation, LeaveRequest } from '@/types';
import { subscribeToUserAttendanceHistory } from '@/firebase';
import { subscribeToUserLeaves } from '@/firebase/leaveService';
import { useAuthStore } from '@/store/authStore';
import UserMonthCalendar from './UserMonthCalendar';
import SelfiePreviewModal from './SelfiePreviewModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ThumbnailImage = ({ url, onPress }: { url: string; onPress: () => void }) => {
  const [loading, setLoading] = useState(true);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.thumbnailWrapper}
    >
      {loading && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}
      <Image
        source={{ uri: url }}
        style={styles.thumbnailImage}
        resizeMode="cover"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
      {!loading && (
        <View style={styles.thumbnailZoomBadge}>
          <Ionicons name="expand" size={10} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );
};

interface AttendanceDetailModalProps {
  visible: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export default function AttendanceDetailModal({
  visible,
  onClose,
  record: initialRecord,
}: AttendanceDetailModalProps) {
  const { user } = useAuthStore();
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (activeRecord?.dateStr && scrollViewRef.current && viewMonth) {
      const activeDate = new Date(activeRecord.dateStr);
      if (activeDate.getMonth() === viewMonth.getMonth() && activeDate.getFullYear() === viewMonth.getFullYear()) {
        const day = activeDate.getDate();
        const offset = (day - 1) * 56 - (SCREEN_WIDTH / 2) + 24 + 16;
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
        }, 300);
      }
    }
  }, [activeRecord, viewMonth]);

  useEffect(() => {
    setActiveRecord(initialRecord);
    if (initialRecord?.dateStr) {
      setViewMonth(new Date(initialRecord.dateStr));
    }
  }, [initialRecord]);
  const [previewSelfie, setPreviewSelfie] = useState<{
    url: string;
    location: AttendanceLocation | null;
    timestamp: string;
  } | null>(null);

  const [employeeEmail, setEmployeeEmail] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(3 / 4);

  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (!initialRecord?.employeeId) {
      setUserHistory([]);
      setLeaves([]);
      return;
    }
    
    const unsubHistory = subscribeToUserAttendanceHistory(initialRecord.employeeId, (records) => {
      setUserHistory(records);
    });

    const unsubLeaves = subscribeToUserLeaves(initialRecord.employeeId, '', (data) => {
      setLeaves(data.filter(l => l.status === 'approved'));
    });

    return () => {
      unsubHistory();
      unsubLeaves();
    };
  }, [initialRecord?.employeeId]);

  const leaveDateSet = React.useMemo(() => {
    const set = new Set<string>();
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [leaves]);



  useEffect(() => {
    if (previewSelfie?.url) {
      setImageAspectRatio(3 / 4); // Reset to default portrait
      Image.getSize(
        previewSelfie.url,
        (width, height) => {
          if (width && height) {
            setImageAspectRatio(width / height);
          }
        },
        (err) => {
          console.warn('Failed to get image size:', err);
        }
      );
    }
  }, [previewSelfie]);

  if (!activeRecord) return null;

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    return formatDateDDMMYYYY(dateObj);
  };



  const openMap = (latitude: number, longitude: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latLng}`
    });
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;

    Linking.openURL(url || webUrl).catch((err) => {
      console.warn("Failed to open map", err);
      Linking.openURL(webUrl);
    });
  };


  const handleDateClick = (dateStr: string) => {
    const found = userHistory.find(r => r.dateStr === dateStr);
    if (found) {
      setActiveRecord(found);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Attendance Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >

            {/* Horizontal Date Selector (Drawer) */}
            <View style={{ marginBottom: Spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.sectionTitle, { color: '#334155' }]}>
                  {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
                    <Ionicons name="chevron-back" size={20} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
                    <Ionicons name="chevron-forward" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                ref={scrollViewRef}
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {Array.from({ length: new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                   const year = viewMonth.getFullYear();
                   const month = viewMonth.getMonth();
                   const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                   
                   const isActive = dateStr === activeRecord.dateStr;
                   const hasRecord = userHistory.some(r => r.dateStr === dateStr);
                   const isLeave = leaveDateSet.has(dateStr);
                   const isPast = new Date(year, month, day) < new Date(new Date().setHours(0,0,0,0));
                   const isWeekend = new Date(year, month, day).getDay() === 0;

                   let bgColor = '#F1F5F9';
                   let textColor = '#64748B';
                   let dotColor = 'transparent';

                   if (hasRecord) {
                     bgColor = '#DCFCE7'; textColor = '#166534'; dotColor = '#166534';
                   } else if (isLeave) {
                     bgColor = '#EDE9FE'; textColor = '#6D28D9'; dotColor = '#6D28D9';
                   } else if (isPast && !isWeekend) {
                     bgColor = '#FEE2E2'; textColor = '#991B1B'; dotColor = '#991B1B';
                   }

                   return (
                     <TouchableOpacity 
                       key={day} 
                       activeOpacity={0.7}
                       disabled={!hasRecord}
                       onPress={() => handleDateClick(dateStr)}
                       style={[
                         { 
                           width: 48, 
                           height: 64, 
                           borderRadius: 12, 
                           backgroundColor: bgColor, 
                           alignItems: 'center', 
                           justifyContent: 'center', 
                           borderWidth: 2, 
                           borderColor: isActive ? '#0F172A' : 'transparent',
                           opacity: (!hasRecord && !isActive) ? 0.6 : 1
                         }
                       ]}
                     >
                       <Text style={{ fontSize: 10, color: textColor, marginBottom: 2, fontWeight: '600' }}>
                         {new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'short' })}
                       </Text>
                       <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>
                         {day}
                       </Text>
                       <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor, marginTop: 4 }} />
                     </TouchableOpacity>
                   );
                })}
              </ScrollView>
            </View>

            {/* Check In Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer18}>
                  <Ionicons name="enter-outline" size={18} color="#2E7D32" />
                </View>
                <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Check In Details</Text>
              </View>

              {activeRecord.checkIn ? (
                <View style={styles.compactRow}>
                  {/* Left Side: Info */}
                  <View style={styles.compactInfoCol}>
                    <View style={styles.compactMetaLine}>
                      <View style={styles.iconContainer18}>
                        <Ionicons name="time-outline" size={14} color={Colors.text.secondary} />
                      </View>
                      <View style={styles.metaTextWrapper}>
                        <Text style={styles.compactMetaValue}>
                          <Text style={styles.boldLabel}>Time: </Text>{formatTime(activeRecord.checkIn.timestamp)}
                        </Text>
                        <View style={styles.deviceMetaInline}>
                          <Ionicons name="hardware-chip-outline" size={14} color={Colors.text.secondary} />
                          <Text style={[styles.compactMetaValue, { marginLeft: 4 }]} numberOfLines={1} ellipsizeMode="tail">
                            {activeRecord.checkIn.deviceInfo || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Address Line with Map Button */}
                    {activeRecord.checkIn.location && (
                      <View style={styles.compactAddressRow}>
                        <View style={styles.iconContainer18}>
                          <Ionicons name="location-outline" size={15} color={Colors.text.secondary} style={{ marginTop: 1 }} />
                        </View>
                        <View style={styles.addressTextWrapper}>
                          <Text style={styles.compactAddressText}>
                            {activeRecord.checkIn.location.address}
                          </Text>
                          <TouchableOpacity
                            style={styles.mapBtn}
                            activeOpacity={0.7}
                            onPress={() => openMap(activeRecord.checkIn!.location!.latitude, activeRecord.checkIn!.location!.longitude, 'Check In Location')}
                          >
                            <Ionicons name="map-outline" size={14} color="#1E88E5" />
                            <Text style={styles.mapBtnTxt}>View on Map</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Right Side: Selfie Thumbnail */}
                  {activeRecord.checkIn.selfieUrl ? (
                    <ThumbnailImage
                      url={activeRecord.checkIn.selfieUrl}
                      onPress={() => setPreviewSelfie({
                        url: activeRecord.checkIn!.selfieUrl!,
                        location: activeRecord.checkIn!.location,
                        timestamp: activeRecord.checkIn!.timestamp
                      })}
                    />
                  ) : (
                    <View style={styles.thumbnailEmpty}>
                      <Ionicons name="camera-outline" size={16} color="#94A3B8" />
                      <Text style={styles.thumbnailEmptyTxt}>No Selfie</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptySectionText}>No Check In record</Text>
              )}

              {/* Remark */}
              {activeRecord.checkIn && !!activeRecord.checkIn.remark && (
                <View style={styles.remarkBoxCompact}>
                  <Text style={styles.remarkLabelCompact}>Remark: </Text>
                  <Text style={styles.remarkTextCompact}>"{activeRecord.checkIn.remark}"</Text>
                </View>
              )}
            </View>

            {/* Check Out Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer18}>
                  <Ionicons name="exit-outline" size={18} color="#C62828" />
                </View>
                <Text style={[styles.sectionTitle, { color: '#C62828' }]}>Check Out Details</Text>
              </View>

              {activeRecord.checkOut ? (
                <View style={styles.compactRow}>
                  {/* Left Side: Info */}
                  <View style={styles.compactInfoCol}>
                    <View style={styles.compactMetaLine}>
                      <View style={styles.iconContainer18}>
                        <Ionicons name="time-outline" size={14} color={Colors.text.secondary} />
                      </View>
                      <View style={styles.metaTextWrapper}>
                        <Text style={styles.compactMetaValue}>
                          <Text style={styles.boldLabel}>Time: </Text>{formatTime(activeRecord.checkOut.timestamp)}
                        </Text>
                        <View style={styles.deviceMetaInline}>
                          <Ionicons name="hardware-chip-outline" size={14} color={Colors.text.secondary} />
                          <Text style={[styles.compactMetaValue, { marginLeft: 4 }]} numberOfLines={1} ellipsizeMode="tail">
                            {activeRecord.checkOut.deviceInfo || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Address Line with Map Button */}
                    {activeRecord.checkOut.location && (
                      <View style={styles.compactAddressRow}>
                        <View style={styles.iconContainer18}>
                          <Ionicons name="location-outline" size={15} color={Colors.text.secondary} style={{ marginTop: 1 }} />
                        </View>
                        <View style={styles.addressTextWrapper}>
                          <Text style={styles.compactAddressText}>
                            {activeRecord.checkOut.location.address}
                          </Text>
                          <TouchableOpacity
                            style={styles.mapBtn}
                            activeOpacity={0.7}
                            onPress={() => openMap(activeRecord.checkOut!.location!.latitude, activeRecord.checkOut!.location!.longitude, 'Check Out Location')}
                          >
                            <Ionicons name="map-outline" size={14} color="#1E88E5" />
                            <Text style={styles.mapBtnTxt}>View on Map</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Right Side: Selfie Thumbnail */}
                  {activeRecord.checkOut.selfieUrl ? (
                    <ThumbnailImage
                      url={activeRecord.checkOut.selfieUrl}
                      onPress={() => setPreviewSelfie({
                        url: activeRecord.checkOut!.selfieUrl!,
                        location: activeRecord.checkOut!.location,
                        timestamp: activeRecord.checkOut!.timestamp
                      })}
                    />
                  ) : (
                    <View style={styles.thumbnailEmpty}>
                      <Ionicons name="camera-outline" size={16} color="#94A3B8" />
                      <Text style={styles.thumbnailEmptyTxt}>No Selfie</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptySectionText}>
                  {activeRecord.checkIn ? 'Shift still in progress (Active)' : 'No Check Out record'}
                </Text>
              )}

              {/* Remark */}
              {activeRecord.checkOut && !!activeRecord.checkOut.remark && (
                <View style={styles.remarkBoxCompact}>
                  <Text style={styles.remarkLabelCompact}>Remark: </Text>
                  <Text style={styles.remarkTextCompact}>"{activeRecord.checkOut.remark}"</Text>
                </View>
              )}
            </View>

            {/* Total Work Hours Summary (Compact Row) at the bottom */}
            {activeRecord.checkOut && (
              <View style={styles.hoursCardCompact}>
                <Ionicons name="time" size={16} color="#1565C0" />
                <Text style={styles.hoursLabelCompact}>TOTAL WORKING HOURS:</Text>
                <Text style={styles.hoursValueCompact}>{activeRecord.workingHours} hrs</Text>
              </View>
            )}

          </ScrollView>
        </View>
      </SafeAreaView>

      <SelfiePreviewModal
        visible={!!previewSelfie}
        url={previewSelfie?.url}
        onClose={() => setPreviewSelfie(null)}
        location={previewSelfie?.location || null}
        timestamp={previewSelfie?.timestamp || null}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.md, // Compact padding
    paddingBottom: Spacing.xxl,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  empName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  empIdLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hoursCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#1E88E5',
  },
  hoursLabelCompact: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1565C0',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  hoursValueCompact: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D47A1',
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  iconContainer18: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  compactInfoCol: {
    flex: 1,
  },
  compactMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaTextWrapper: {
    flex: 1,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceMetaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  compactMetaValue: {
    fontSize: 12,
    color: '#475569',
  },
  boldLabel: {
    fontWeight: '600',
    color: '#64748B',
  },
  compactAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressTextWrapper: {
    flex: 1,
    marginLeft: 6,
  },
  compactAddressText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  mapBtnTxt: {
    color: '#1E88E5',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailWrapper: {
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailZoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 2,
  },
  thumbnailEmpty: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmptyTxt: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  remarkBoxCompact: {
    flexDirection: 'row',
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#FFF59D',
    borderRadius: 4,
    padding: 6,
    marginTop: 8,
  },
  remarkLabelCompact: {
    fontSize: 11,
    fontWeight: '700',
    color: '#827717',
  },
  remarkTextCompact: {
    flex: 1,
    fontSize: 11,
    color: '#554F0F',
    fontStyle: 'italic',
  },
  emptySectionText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewImageWrap: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewWatermark: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  previewWatermarkAddress: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  previewWatermarkMeta: {
    color: '#CBD5E1',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
});
