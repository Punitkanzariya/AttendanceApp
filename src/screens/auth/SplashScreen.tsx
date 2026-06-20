import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation  = useNavigation<Nav>();
  const { width }   = useWindowDimensions();

  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.8)).current;
  const progW    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.timing(progW, {
      toValue: width * 0.5,
      duration: 2200,
      delay: 400,
      useNativeDriver: false,
    }).start();

    const t = setTimeout(() => navigation.replace('Welcome'), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoBox}>
          <Ionicons name="checkmark-done" size={40} color="#fff" />
        </View>
        <Text style={styles.name}>WorkTrack</Text>
        <Text style={styles.tag}>Smart Workforce Management</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <View style={[styles.track, { width: width * 0.5 }]}>
          <Animated.View style={[styles.fill, { width: progW }]} />
        </View>
        <Text style={styles.version}>Enterprise Edition</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center:   { alignItems: 'center' },
  logoBox: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  name: {
    fontSize: 34, fontWeight: '800',
    color: '#fff', letterSpacing: 1,
    marginBottom: 6,
  },
  tag: { fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },

  bottom: { position: 'absolute', bottom: 48, alignItems: 'center', gap: 10 },
  track: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 99 },
  version: { fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.8 },
});
