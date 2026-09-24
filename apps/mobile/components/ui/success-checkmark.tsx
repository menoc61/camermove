import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface SuccessCheckmarkProps {
  size?: number;
  color?: string;
  delayMs?: number;
}

/**
 * Square-bordered checkmark badge with a three-stage animated reveal:
 *
 *   1. Border fades in   (160ms)
 *   2. Check stroke draws on via scaleX 0 → 1 (280ms ease-out, delayed 120ms)
 *   3. Pulse ring radiates outward (320ms)
 *
 * Built with pure View transforms so it works without a Lottie runtime.
 * Reduce-motion: snap to final state instantly, no stroke draw.
 */
export function SuccessCheckmark({
  size = 56,
  color = colors.ink,
  delayMs = 0,
}: SuccessCheckmarkProps) {
  const reduced = useReduceMotion();
  const border = useSharedValue(reduced ? 1 : 0);
  const stroke = useSharedValue(reduced ? 1 : 0);
  const ring = useSharedValue(reduced ? 0 : 1);

  useEffect(() => {
    if (reduced) return;
    border.value = withDelay(delayMs, withTiming(1, { duration: motion.duration.fast }));
    stroke.value = withDelay(
      delayMs + 120,
      withTiming(1, {
        duration: motion.duration.base,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );
    ring.value = withDelay(
      delayMs + 60,
      withSequence(
        withTiming(1.6, { duration: motion.duration.base, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(1, { duration: motion.duration.fast }),
      ),
    );
  }, [border, stroke, ring, delayMs, reduced]);

  const borderStyle = useAnimatedStyle(() => ({
    opacity: border.value,
    transform: [{ scale: 0.92 + 0.08 * border.value }],
  }));

  const strokeStyle = useAnimatedStyle(() => ({
    opacity: stroke.value,
    transform: [{ scaleX: stroke.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 1.55 ? 0 : 1 - (ring.value - 1) / 0.55,
    transform: [{ scale: ring.value }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderColor: color,
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            backgroundColor: color,
            borderColor: color,
          },
          borderStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.checkStem,
            {
              backgroundColor: colors.paper,
              left: size * 0.28,
              top: size * 0.5,
              width: size * 0.18,
              height: 2,
            },
            strokeStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.checkStroke,
            {
              backgroundColor: colors.paper,
              left: size * 0.28,
              top: size * 0.42,
              width: size * 0.42,
              height: 2,
              transformOrigin: "0% 50%",
            },
            strokeStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    borderWidth: 1,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  checkStem: {
    position: "absolute",
    transform: [{ rotate: "45deg" }],
  },
  checkStroke: {
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
  },
});
