import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform, ActivityIndicator, Image, StyleSheet, Dimensions, Linking, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors, Shadow } from '@/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface SelfiePreviewModalProps {
  visible: boolean;
  url: string | null | undefined;
  onClose: () => void;
  location: {
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  timestamp: string | null;
}

export default function SelfiePreviewModal({ visible, url, onClose, location, timestamp }: SelfiePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [webImgHeight, setWebImgHeight] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setScale(1);
      if (url) {
        Image.getSize(url, (w, h) => setImageAspect(w / h), () => setImageAspect(null));
      } else {
        setImageAspect(null);
      }
    }
  }, [visible, url]);

  if (!url) return null;

  const downloadImage = () => {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selfie.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      Linking.openURL(url);
    }
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="camera" size={24} color={Colors.primary} />
              <Text style={styles.title}>Selfie Preview</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Image Area */}
            <View style={styles.imageWrapper}>
              {Platform.OS === 'web' ? (
                <View style={{ position: 'relative', width: '100%', height: (scale > 1 && webImgHeight) ? webImgHeight : 'auto', minHeight: isLoading ? 200 : undefined }}>
                  {isLoading && (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  )}
                  <View 
                    style={{ overflow: 'auto', width: '100%', height: (scale > 1 && webImgHeight) ? '100%' : 'auto', borderRadius: 12 }}
                    onLayout={(e) => {
                      if (scale === 1) setWebImgHeight(e.nativeEvent.layout.height);
                    }}
                  >
                    <img
                      src={url}
                      style={{ 
                        margin: 'auto', display: 'block', width: scale === 1 ? '100%' : `${100 * scale}%`,
                        maxHeight: scale === 1 ? SCREEN_HEIGHT * 0.55 : 'none',
                        objectFit: "contain", borderRadius: 12
                      }}
                      onLoad={() => setIsLoading(false)}
                    />
                  </View>
                  {!isLoading && (
                    <View style={styles.zoomControls}>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(s => Math.min(s + 0.5, 4))}>
                        <Ionicons name="add" size={20} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(s => Math.max(s - 0.5, 1))}>
                        <Ionicons name="remove" size={20} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(1)}>
                        <Ionicons name="expand" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                  </View>
                ) : (
                  <View style={{ position: 'relative', width: '100%', height: imageAspect ? (SCREEN_WIDTH * 0.9 - 32) / imageAspect : 300, borderRadius: 12, overflow: 'hidden' }}>
                    {isLoading && (
                      <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                      </View>
                    )}
                    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }} bounces={false} maximumZoomScale={1}>
                      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }} bounces={false} maximumZoomScale={1}>
                        <Image
                          source={{ uri: url || '' }}
                          style={{
                            width: (SCREEN_WIDTH - 64) * scale,
                            height: imageAspect ? ((SCREEN_WIDTH - 64) / imageAspect) * scale : 300 * scale,
                            resizeMode: 'contain'
                          }}
                          onLoad={() => setIsLoading(false)}
                        />
                      </ScrollView>
                    </ScrollView>
                    {!isLoading && (
                      <View style={styles.zoomControls}>
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(s => Math.min(s + 0.5, 4))}>
                          <Ionicons name="add" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(s => Math.max(s - 0.5, 1))}>
                          <Ionicons name="remove" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => setScale(1)}>
                          <Ionicons name="expand" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
            </View>

            {/* Location Details Card */}
            <View style={styles.detailsCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name="location" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardSubtitle}>Location Details</Text>
                  <Text style={styles.cardTitle}>{location?.address || 'GPS Location'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.gridContainer}>
                <View style={styles.gridRow}>
                  <View style={[styles.gridCell, styles.cellBorderRight, styles.cellBorderBottom]}>
                    <View style={styles.gridIconCircle}>
                      <Ionicons name="time-outline" size={18} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.gridLabel}>Time</Text>
                      <Text style={styles.gridValue}>{formatTime(timestamp)}</Text>
                    </View>
                  </View>
                  <View style={[styles.gridCell, styles.cellBorderBottom, { paddingLeft: 16 }]}>
                    <View style={styles.gridIconCircle}>
                      <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.gridLabel}>Date</Text>
                      <Text style={styles.gridValue}>{formatDate(timestamp)}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.gridRow}>
                  <View style={[styles.gridCell, styles.cellBorderRight]}>
                    <View style={styles.gridIconCircle}>
                      <Ionicons name="locate-outline" size={18} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.gridLabel}>Latitude</Text>
                      <Text style={styles.gridValue}>{location?.latitude?.toFixed(6) || 'N/A'}</Text>
                    </View>
                  </View>
                  <View style={[styles.gridCell, { paddingLeft: 16 }]}>
                    <View style={styles.gridIconCircle}>
                      <Ionicons name="globe-outline" size={18} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.gridLabel}>Longitude</Text>
                      <Text style={styles.gridValue}>{location?.longitude?.toFixed(6) || 'N/A'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  container: { width: '100%', maxWidth: 500, maxHeight: '95%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', ...Shadow.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 16, overflow: 'hidden' },
  loaderContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', zIndex: 10 },
  zoomControls: { position: 'absolute', top: 12, right: 12, gap: 8 },
  zoomBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  detailsCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  cardSubtitle: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  cardTitle: { fontSize: 14, color: '#1E293B', fontWeight: '600', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  gridContainer: { width: '100%' },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  cellBorderRight: { borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  cellBorderBottom: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  gridIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  gridLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  gridValue: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF', gap: 8 },
  outlineBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 8, backgroundColor: Colors.primary, gap: 8 },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
