import { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation  = useNavigation<Nav>();

  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, tension: 40, friction: 6, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => navigation.replace('Login'), 3200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffffff" />
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <Animated.Image 
          source={require('../../../assets/splash-icon.png')} 
          style={styles.image} 
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center:   { alignItems: 'center', justifyContent: 'center' },
  image: {
    width: 250,
    height: 250,
    resizeMode: 'contain',
  }
});
