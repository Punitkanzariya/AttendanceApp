import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../types';
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '../../theme';

interface BirthdayModalProps {
  user: User | null;
}

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const CONFETTI_COLORS = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
const EMOJIS = ['🎂', '🎉', '🎈', '🥳', '🎁', '✨', '🎊'];

const ConfettiPiece = ({ delay, left, width, height, color, isCircle, flipDirection, emoji }: any) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fallDuration = Math.random() * 4000 + 3000; // Wider fall duration: 3s to 7s
    const swayDistance = Math.random() * 80 - 40;
    
    // Horizontal sway animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: swayDistance, duration: fallDuration / 2, easing: Easing.sin, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: fallDuration / 2, easing: Easing.sin, useNativeDriver: true })
      ])
    ).start();

    // Fall animation
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: windowHeight + 100,
            duration: fallDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: fallDuration * 0.6,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(scale, { toValue: 0.5, duration: fallDuration / 2, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.2, duration: fallDuration / 2, useNativeDriver: true })
          ])
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: flipDirection ? ['-30deg', '30deg'] : ['30deg', '-30deg'] // Gentle sway for emojis instead of full spin
  });

  const fullSpin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: flipDirection ? ['0deg', '360deg'] : ['360deg', '0deg']
  });

  return (
    <Animated.View style={{
      position: 'absolute',
      left,
      top: -30,
      width: emoji ? undefined : width,
      height: emoji ? undefined : height,
      borderRadius: emoji ? 0 : (isCircle ? Math.max(width, height) / 2 : 2),
      backgroundColor: emoji ? 'transparent' : color,
      justifyContent: 'center',
      alignItems: 'center',
      transform: emoji ? [
        { translateX }, 
        { translateY }, 
        { rotate: spin }, // Gentle 2D sway for emojis
        { scale }
      ] : [
        { translateX }, 
        { translateY }, 
        { rotateX: fullSpin }, 
        { rotateY: fullSpin }, 
        { rotate: fullSpin },
        { scale }
      ]
    }}>
      {emoji ? <Text style={{ fontSize: width, textAlign: 'center' }}>{emoji}</Text> : null}
    </Animated.View>
  );
};

const ContinuousConfetti = () => {
  const pieces = useRef(Array.from({ length: 130 }).map((_, i) => {
    const isEmoji = Math.random() > 0.85; // 15% chance to be an emoji
    const baseSize = isEmoji ? Math.random() * 10 + 16 : Math.random() * 6 + 6; // Emojis size (16-26), normal (6-12)
    const isRibbon = !isEmoji && Math.random() > 0.6; // 40% chance of remaining shapes to be a ribbon
    
    return {
      id: i,
      left: Math.random() * windowWidth,
      delay: Math.random() * 8000, // Stagger over 8 seconds for a perfectly even distribution
      width: baseSize,
      height: isRibbon ? baseSize * 1.8 : baseSize,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      isCircle: !isRibbon && Math.random() > 0.5,
      flipDirection: Math.random() > 0.5,
      emoji: isEmoji ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] : null
    };
  })).current;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none">
      {pieces.map(p => (
        <Animated.View key={p.id} style={{ position: 'absolute' }}>
          <ConfettiPiece 
            left={p.left} delay={p.delay} width={p.width} height={p.height} 
            color={p.color} isCircle={p.isCircle} flipDirection={p.flipDirection} 
            emoji={p.emoji}
          />
        </Animated.View>
      ))}
    </View>
  );
};

export function BirthdayModal({ user }: BirthdayModalProps) {
  const [visible, setVisible] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkBirthday();
  }, [user]);

  const checkBirthday = async () => {
    if (!user || !user.dateOfBirth) return;

    try {
      // Parse the DOB ignoring the year
      const dobDate = new Date(user.dateOfBirth);
      const dobMonth = dobDate.getMonth();
      const dobDay = dobDate.getDate();

      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      if (dobMonth === todayMonth && dobDay === todayDay) {
        // It's their birthday today! Check if we already showed it today.
        const todayStr = today.toISOString().split('T')[0];
        const lastShown = await AsyncStorage.getItem('@last_birthday_popup_shown');

        if (lastShown !== todayStr) {
          // Haven't shown it today, show it!
          setVisible(true);
          await AsyncStorage.setItem('@last_birthday_popup_shown', todayStr);
          animateIn();
        }
      }
    } catch (e) {
      console.log('Error checking birthday modal:', e);
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => setVisible(false));
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {visible && <ContinuousConfetti />}
        <Animated.View 
          style={[
            styles.modalContainer, 
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="gift" size={40} color="#F59E0B" />
            </View>
            
            <Text style={styles.title}>Happy Birthday!</Text>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
            
            <Text style={styles.message}>
              Wishing you a fantastic day filled with joy and celebration.{"\n"}
              — From the whole team
            </Text>

            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>Thank You!</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.xButton} onPress={handleClose} hitSlop={{top:10, bottom:10, left:10, right:10}}>
            <Ionicons name="close" size={24} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    zIndex: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
    iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 4,
    textAlign: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  xButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
