import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Animated, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';

type Nav          = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
type IoniconName  = React.ComponentProps<typeof Ionicons>['name'];

interface Slide { icon: IoniconName; color: string; bg: string; title: string; body: string }

// Slides updated to match PRD features exactly
const SLIDES: Slide[] = [
  { icon: 'location',       color: '#2563EB', bg: '#EFF6FF', title: 'GPS Check-In',        body: 'Mark attendance securely from verified project sites with GPS.' },
  { icon: 'receipt',        color: '#059669', bg: '#ECFDF5', title: 'Expense Workflow',    body: 'Submit bills for quick multi-level approval and reimbursement.' },
  { icon: 'calendar-clear', color: '#D97706', bg: '#FFFBEB', title: 'Leave Management',    body: 'Apply for leaves seamlessly and check your balances anytime.' },
];

export default function WelcomeScreen() {
  const navigation       = useNavigation<Nav>();
  const { width, height } = useWindowDimensions();
  const scrollRef        = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);
  const fadeAnim         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const id = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % SLIDES.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Top Brand */}
      <Animated.View style={[styles.brand, { opacity: fadeAnim }]}>
        <View style={styles.brandIcon}>
          <Ionicons name="checkmark-done" size={18} color="#fff" />
        </View>
        <Text style={styles.brandName}>WorkTrack</Text>
      </Animated.View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Manage Your{'\n'}Workforce Smarter</Text>
        <Text style={styles.heroSub}>Attendance · Expenses · Leave · Reports</Text>
      </View>

      {/* Slide Area */}
      <View style={[styles.slideWrapper, { height: height * 0.28 }]}>
        <ScrollView
          ref={scrollRef}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={[styles.slide, { width }]}>
              <View style={[styles.slideIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={30} color={s.color} />
              </View>
              <Text style={[styles.slideTitle, { color: s.color }]}>{s.title}</Text>
              <Text style={styles.slideBody}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: i === current ? 20 : 6, backgroundColor: i === current ? '#2563EB' : '#CBD5E1' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Footer CTAs */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Signup')} activeOpacity={0.88}>
          <Text style={styles.btnPrimaryText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
          <Text style={styles.btnOutlineText}>Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.secure}>🔒  AES-256 Secured · App Check Enabled</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  brandIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: '800', color: '#fff' },

  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff', lineHeight: 40, marginBottom: 8 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  slideWrapper: { overflow: 'hidden' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  slideIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  slideTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  slideBody: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { height: 6, borderRadius: 3 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnOutlineText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secure: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.30)', paddingTop: 2 },
});
