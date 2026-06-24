import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Colors } from '@/theme';
import { WebView } from 'react-native-webview';

interface GeoFenceMapProps {
  latitude: string;
  longitude: string;
  radius: string;
  userLatitude?: string;
  userLongitude?: string;
}

export default function GeoFenceMap({ latitude, longitude, radius, userLatitude, userLongitude }: GeoFenceMapProps) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const rad = parseFloat(radius) || 200;
  
  const uLat = userLatitude ? parseFloat(userLatitude) : null;
  const uLng = userLongitude ? parseFloat(userLongitude) : null;

  const mapHtml = useMemo(() => {
    if (isNaN(lat) || isNaN(lng)) return '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
          <style>
              body { padding: 0; margin: 0; background-color: #f8fafc; }
              #map { height: 100vh; width: 100vw; }
          </style>
      </head>
      <body>
          <div id="map"></div>
          <script>
              var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 16);
              // Use Esri Satellite tiles for a satellite view
              L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                  maxZoom: 19
              }).addTo(map);
              
              var marker = L.marker([${lat}, ${lng}]).addTo(map);
              var circle = L.circle([${lat}, ${lng}], {
                  color: '#0ea5e9',
                  fillColor: '#38bdf8',
                  fillOpacity: 0.3,
                  radius: ${rad}
              }).addTo(map);
              
              var bounds = circle.getBounds();

              ${uLat !== null && uLng !== null ? `
              var userIcon = L.icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41]
              });
              var userMarker = L.marker([${uLat}, ${uLng}], {icon: userIcon}).addTo(map);
              bounds.extend(userMarker.getLatLng());
              ` : ''}

              map.fitBounds(bounds, { padding: [20, 20] });
          </script>
      </body>
      </html>
    `;
  }, [lat, lng, rad, uLat, uLng]);

  if (isNaN(lat) || isNaN(lng)) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Enter valid coordinates to view map</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe 
          srcDoc={mapHtml} 
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title="GeoFence Map"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 15,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeholderContainer: {
    height: 200,
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 14,
  }
});
