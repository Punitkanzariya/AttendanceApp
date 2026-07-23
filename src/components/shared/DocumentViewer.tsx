import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform, ActivityIndicator, Image, StyleSheet, Dimensions, Linking, ScrollView } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadow } from '@/theme';
import { WebView } from 'react-native-webview';

interface DocumentViewerProps {
  visible: boolean;
  url: string | null | undefined;
  onClose: () => void;
  title?: string;
  overlayComponent?: React.ReactNode;
}

export default function DocumentViewer({ visible, url, onClose, title = "Document Viewer", overlayComponent }: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [webImgHeight, setWebImgHeight] = useState<number | null>(null);

  // Reset loader when URL changes
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setScale(1);
      if (url && !url.toLowerCase().includes('.pdf')) {
        Image.getSize(url, (w, h) => setImageAspect(w / h), () => setImageAspect(null));
      } else {
        setImageAspect(null);
      }
    }
  }, [visible, url]);

  if (!url) return null;

  const isPdf = url.toLowerCase().includes('.pdf');

  const containerStyle: any = [styles.container];
  if (isPdf) {
    containerStyle.push({ height: SCREEN_HEIGHT * 0.85 });
  } else if (Platform.OS === 'web') {
    containerStyle.push({ maxHeight: SCREEN_HEIGHT * 0.85, height: 'auto' });
  } else {
    if (imageAspect) {
      const calculatedHeight = (SCREEN_WIDTH * 0.95) / imageAspect;
      containerStyle.push({ height: Math.min(calculatedHeight + 80, SCREEN_HEIGHT * 0.85) });
    } else {
      containerStyle.push({ height: SCREEN_HEIGHT * 0.85 });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={containerStyle}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <View style={styles.content}>
            {isPdf ? (
              Platform.OS === 'web' ? (
                <View style={{ flex: 1, backgroundColor: '#fff' }}>
                  {isLoading && (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  )}
                  <iframe
                    src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
                    onLoad={() => setIsLoading(false)}
                  />
                </View>
              ) : (
                <WebView
                  source={{
                    uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`,
                  }}
                  style={{ flex: 1 }}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  )}
                />
              )
            ) : (
              <View style={{ flex: 1, backgroundColor: '#fff' }}>
                {Platform.OS === 'web' ? (
                   <View style={{ position: 'relative', width: '100%', height: (scale > 1 && webImgHeight) ? webImgHeight : 'auto', minHeight: isLoading ? 200 : undefined }}>
                     {isLoading && (
                        <View style={[styles.loaderContainer, { minHeight: 200 }]}>
                          <ActivityIndicator size="large" color={Colors.primary} />
                          <Text style={{ marginTop: 12, color: Colors.text.secondary, fontWeight: '500' }}>Loading document...</Text>
                        </View>
                     )}
                     <View 
                       style={{ overflow: 'auto', width: '100%', height: (scale > 1 && webImgHeight) ? '100%' : 'auto' }}
                       onLayout={(e) => {
                         if (scale === 1) {
                           setWebImgHeight(e.nativeEvent.layout.height);
                         }
                       }}
                     >
                       <img
                         src={url}
                         style={{ 
                           margin: 'auto', display: 'block', width: scale === 1 ? '100%' : `${100 * scale}%`,
                           maxHeight: scale === 1 ? (SCREEN_HEIGHT * 0.85) - 100 : 'none',
                           objectFit: "contain"
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
                           <Ionicons name="expand" size={16} color="#FFF" />
                         </TouchableOpacity>
                       </View>
                     )}
                   </View>
                ) : (
                  <View style={{ position: 'relative', width: '100%', height: imageAspect ? (SCREEN_WIDTH * 0.95) / imageAspect : 300, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
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
                            width: (SCREEN_WIDTH * 0.95) * scale,
                            height: imageAspect ? ((SCREEN_WIDTH * 0.95) / imageAspect) * scale : 300 * scale,
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
                          <Ionicons name="expand" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                {overlayComponent && (
                  <View style={styles.overlayWrapper}>
                    {overlayComponent}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '95%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    flex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  overlayWrapper: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 100,
  },
  zoomControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 10,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
});
