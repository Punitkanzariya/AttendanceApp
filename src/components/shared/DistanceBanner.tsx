import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors } from "@/theme";

interface DistanceBannerProps {
  isVisible: boolean;
  distanceKm: number;
  projectName: string;
  onHideComplete: () => void;
}

const { width } = Dimensions.get("window");

// Generate small sine waves for the bottom border
const waveCount = 18;
const waveWidth = width / waveCount;
const waveHeight = 6;
const waveStartY = 0;

let wavePath = `M 0 0 L 0 ${waveStartY} `;
for (let i = 0; i < waveCount; i++) {
  const startX = i * waveWidth;
  const q1X = startX + waveWidth / 4;
  const midX = startX + waveWidth / 2;
  const endX = startX + waveWidth;
  
  wavePath += `Q ${q1X} ${waveStartY + waveHeight}, ${midX} ${waveStartY} `;
  wavePath += `T ${endX} ${waveStartY} `;
}
wavePath += `L ${width} 0 Z`;

export default function DistanceBanner({
  isVisible,
  distanceKm,
  projectName,
  onHideComplete,
}: DistanceBannerProps) {
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in (push content down)
      Animated.timing(heightAnim, {
        toValue: 80, // Estimated height of banner
        duration: 400,
        useNativeDriver: false, // Height animation doesn't support native driver
      }).start();

      // Wait 3.5 seconds, then animate out (pull content up)
      const timeout = setTimeout(() => {
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }).start(() => {
          onHideComplete();
        });
      }, 3500);

      return () => clearTimeout(timeout);
    }
  }, [isVisible, heightAnim, onHideComplete]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: heightAnim,
          opacity: heightAnim.interpolate({
            inputRange: [0, 80],
            outputRange: [0, 1],
          }),
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          You are {distanceKm.toFixed(1)} km away from {projectName} site!
        </Text>
        <Text style={styles.subtitle}>
          Please move closer to the site location to clock in.
        </Text>
      </View>
      <View style={styles.waveContainer}>
        <Svg
          height="12"
          width={width}
          viewBox={`0 0 ${width} 12`}
          preserveAspectRatio="none"
        >
          <Path
            d={wavePath}
            fill="#FEF08A" // Yellow matching the banner content
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    zIndex: 10,
    elevation: 10,
    backgroundColor: "transparent", // Must be transparent to see the waves!
  },
  content: {
    backgroundColor: "#FEF08A",
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#854D0E", // Dark yellow/brown text
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#A16207",
    fontWeight: "500",
    textAlign: "center",
    opacity: 0.9,
  },
  waveContainer: {
    height: 12,
    width: "100%",
    backgroundColor: "transparent",
    marginTop: -1, // Remove 1px gap
  },
});
