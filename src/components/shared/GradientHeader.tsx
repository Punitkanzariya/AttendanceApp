import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme';

interface GradientHeaderProps {
  height?: number;
}

export default function GradientHeader({ height = 250 }: GradientHeaderProps) {
  return (
    <LinearGradient
      colors={["#BFDBFE", Colors.employeeBg]}
      style={[styles.gradientHeader, { height }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    />
  );
}

const styles = StyleSheet.create({
  gradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 250,
  },
});
