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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import { Colors, Spacing, BorderRadius } from '@/theme';
import type { AttendanceRecord, AttendanceLocation } from '@/types';
import { subscribeToUserAttendanceHistory } from '@/firebase';
import UserMonthCalendar from './UserMonthCalendar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    setActiveRecord(initialRecord);
  }, [initialRecord]);
  const [previewSelfie, setPreviewSelfie] = useState<{
    url: string;
    location: AttendanceLocation | null;
    timestamp: string;
  } | null>(null);

  const [employeeEmail, setEmployeeEmail] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(3 / 4);

  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!initialRecord?.employeeId) {
      setUserHistory([]);
      return;
    }
    
    // Fetch full history for the calendar
    const unsub = subscribeToUserAttendanceHistory(initialRecord.employeeId, (records) => {
      setUserHistory(records);
    });

    return () => unsub();
  }, [initialRecord?.employeeId]);

  useEffect(() => {
    if (!activeRecord) {
      setEmployeeEmail(null);
      return;
    }
    if (activeRecord.employeeEmail) {
      setEmployeeEmail(activeRecord.employeeEmail);
      return;
    }
    
    const fetchEmail = async () => {
      try {
        const userDocRef = doc(db, 'users', activeRecord.employeeId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.email) {
            setEmployeeEmail(data.email);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch employee email:', err);
      }
    };
    fetchEmail();
  }, [activeRecord]);

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

  const getVerificationBadgeStyles = (status: string) => {
    switch (status) {
      case 'verified':
        return { bg: '#E8F5E9', border: '#C8E6C9', color: '#2E7D32', text: 'VERIFIED' };
      case 'rejected':
        return { bg: '#FFEBEE', border: '#FFCDD2', color: '#C62828', text: 'REJECTED' };
      default:
        return { bg: '#FFF8E1', border: '#FFE082', color: '#F57F17', text: 'PENDING VERIFICATION' };
    }
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

  const badge = getVerificationBadgeStyles(activeRecord.verificationStatus);

  const handleDateClick = (dateStr: string) => {
    const found = userHistory.find(r => r.dateStr === dateStr);
    if (found) {
      setActiveRecord(found);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Attendance Details</Text>
              <Text style={styles.headerSubtitle}>{formatDate(activeRecord.dateStr)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Employee Name & Verification Status */}
            <View style={styles.metaRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.empName}>{activeRecord.employeeName}</Text>
                {employeeEmail ? (
                  <Text style={styles.empIdLabel} numberOfLines={1} ellipsizeMode="tail">
                    {employeeEmail}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
              </View>
            </View>

            {/* Total Work Hours Summary (Compact Row) */}
            {activeRecord.checkOut && (
              <View style={styles.hoursCardCompact}>
                <Ionicons name="time" size={16} color="#1565C0" />
                <Text style={styles.hoursLabelCompact}>TOTAL WORKING HOURS:</Text>
                <Text style={styles.hoursValueCompact}>{activeRecord.workingHours} hrs</Text>
              </View>
            )}

            {/* Monthly Calendar View for User */}
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.sectionTitle, { marginBottom: 8, color: '#334155' }]}>
                Attendance Calendar
              </Text>
              <UserMonthCalendar 
                records={userHistory} 
                selectedDate={new Date(initialRecord?.dateStr || new Date().toISOString())} 
                activeDateStr={activeRecord.dateStr}
                onDateClick={handleDateClick}
              />
            </View>

            {/* Clock In Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer18}>
                  <Ionicons name="enter-outline" size={18} color="#2E7D32" />
                </View>
                <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Clock In Details</Text>
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
                            onPress={() => openMap(activeRecord.checkIn!.location!.latitude, activeRecord.checkIn!.location!.longitude, 'Clock In Location')}
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
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setPreviewSelfie({
                        url: activeRecord.checkIn!.selfieUrl!,
                        location: activeRecord.checkIn!.location,
                        timestamp: activeRecord.checkIn!.timestamp
                      })}
                      style={styles.thumbnailWrapper}
                    >
                      <Image
                        source={{ uri: activeRecord.checkIn.selfieUrl }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                      <View style={styles.thumbnailZoomBadge}>
                        <Ionicons name="expand" size={10} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.thumbnailEmpty}>
                      <Ionicons name="camera-outline" size={16} color="#94A3B8" />
                      <Text style={styles.thumbnailEmptyTxt}>No Selfie</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptySectionText}>No Clock In record</Text>
              )}

              {/* Remark */}
              {activeRecord.checkIn && !!activeRecord.checkIn.remark && (
                <View style={styles.remarkBoxCompact}>
                  <Text style={styles.remarkLabelCompact}>Remark: </Text>
                  <Text style={styles.remarkTextCompact}>"{activeRecord.checkIn.remark}"</Text>
                </View>
              )}
            </View>

            {/* Clock Out Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer18}>
                  <Ionicons name="exit-outline" size={18} color="#C62828" />
                </View>
                <Text style={[styles.sectionTitle, { color: '#C62828' }]}>Clock Out Details</Text>
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
                            onPress={() => openMap(activeRecord.checkOut!.location!.latitude, activeRecord.checkOut!.location!.longitude, 'Clock Out Location')}
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
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setPreviewSelfie({
                        url: activeRecord.checkOut!.selfieUrl!,
                        location: activeRecord.checkOut!.location,
                        timestamp: activeRecord.checkOut!.timestamp
                      })}
                      style={styles.thumbnailWrapper}
                    >
                      <Image
                        source={{ uri: activeRecord.checkOut.selfieUrl }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                      <View style={styles.thumbnailZoomBadge}>
                        <Ionicons name="expand" size={10} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.thumbnailEmpty}>
                      <Ionicons name="camera-outline" size={16} color="#94A3B8" />
                      <Text style={styles.thumbnailEmptyTxt}>No Selfie</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptySectionText}>
                  {activeRecord.checkIn ? 'Shift still in progress (Active)' : 'No Clock Out record'}
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
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Fullscreen Selfie Preview Modal */}
      {previewSelfie && (
        <Modal
          visible={!!previewSelfie}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewSelfie(null)}
        >
          <View style={styles.previewBackdrop}>
            <View style={styles.previewContainer}>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setPreviewSelfie(null)}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={[styles.previewImageWrap, { aspectRatio: imageAspectRatio }]}>
                <Image
                  source={{ uri: previewSelfie.url }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                
                {/* Full GPS Watermark Overlay */}
                <View style={styles.previewWatermark}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="location" size={14} color="#F87171" style={{ marginTop: 1 }} />
                    <Text style={[styles.previewWatermarkAddress, { flex: 1 }]}>
                      {previewSelfie.location?.address || 'GPS Location'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={14} color="#CBD5E1" />
                    <Text style={[styles.previewWatermarkMeta, { marginTop: 0, flex: 1 }]}>
                      {formatTime(previewSelfie.timestamp)} | Lat: {previewSelfie.location?.latitude?.toFixed(6) || 'N/A'}, Lon: {previewSelfie.location?.longitude?.toFixed(6) || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
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
