import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Override the default rectangular radius. Default 0 (Swiss/Bauhaus). */
  radius?: number;
  style?: ViewStyle;
}

/**
 * Placeholder block that shimmers left-to-right while a real value is loading.
 * Collapses to a static block when reduce-motion is on so it never becomes a
 * distracting flash for users who opted out of motion.
 */
export function Skeleton({ width = "100%", height = 14, radius = 0, style }: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: motion.duration.slow * 4 }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${(progress.value - 0.5) * 200}%` }],
    opacity: reduceMotion ? 1 : 0.6 + progress.value * 0.4,
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {!reduceMotion ? (
        <Animated.View style={[styles.shimmer, barStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: colors.surface3,
  },
});
