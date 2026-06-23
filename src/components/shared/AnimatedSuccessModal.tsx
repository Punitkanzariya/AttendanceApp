import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';

interface AnimatedSuccessModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

export default function AnimatedSuccessModal({ visible, message, onClose }: AnimatedSuccessModalProps) {
  const tickScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      tickScale.value = 0;
      tickScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 120 }));
    }
  }, [visible]);

  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          
          <View style={styles.iconWrapper}>
             <Animated.View style={[styles.tickCircle, tickStyle]}>
               <Ionicons name="checkmark" size={32} color={Colors.white} />
             </Animated.View>
          </View>
          
          <Text style={styles.title}>Success</Text>
          <Text style={styles.message}>{message}</Text>
          
          <TouchableOpacity style={styles.okBtn} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.okBtnTxt}>OK</Text>
          </TouchableOpacity>

        </View>
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
    zIndex: 9999,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: 280,
    alignItems: 'center',
    // Completely flat, no shadow
    elevation: 0,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5', // Light emerald background, static
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tickCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981', // Emerald green
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  okBtn: {
    backgroundColor: '#3B82F6', // Blue
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  okBtnTxt: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  }
});
