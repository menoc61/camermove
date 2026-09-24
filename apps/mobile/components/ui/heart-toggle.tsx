import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface HeartToggleProps {
  active: boolean;
  onToggle: () => void;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * Favourite heart toggle with a layered "pop" animation:
 *  - Stroke → filled morph (200ms cross-fade via opacity)
 *  - Scale: 1 → 1.3 → 0.92 → 1 (spring chain)
 *  - Particle-like ring pulse radiating outward
 *
 * Reduce-motion: snap state without scale/ring.
 */
export function HeartToggle({
  active,
  onToggle,
  size = 28,
  style,
  accessibilityLabel,
}: HeartToggleProps) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const ring = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, {
      duration: reduced ? 0 : motion.duration.fast,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [active, opacity, reduced]);

  function press() {
    onToggle();
    if (reduced) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 320 }),
      withSpring(0.92, { damping: 14, stiffness: 280 }),
      withSpring(1, { damping: 18, stiffness: 220 }),
    );
    rotate.value = withSequence(
      withTiming(0.15, { duration: motion.duration.fast }),
      withSpring(0, { damping: 14, stiffness: 220 }),
    );
    ring.value = withSequence(
      withTiming(1, { duration: motion.duration.base }),
      withTiming(0, { duration: motion.duration.base }),
    );
  }

  const inner = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}rad` }],
  }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - opacity.value }));
  const filled = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 1 + ring.value * 0.8 }],
  }));

  return (
    <Animated.View
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={accessibilityLabel ?? (active ? "Retirer des favoris" : "Ajouter aux favoris")}
      onTouchEnd={press}
      style={[styles.tap, { width: size, height: size }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: 0, borderColor: "#B3261E" },
          ringStyle,
        ]}
      />
      <Animated.View style={[styles.layer, inner]}>
        <Animated.Text
          style={[
            styles.glyph,
            { fontSize: size, lineHeight: size * 1.05, color: colors.ink2 },
            outline,
          ]}
        >
          ♡
        </Animated.Text>
        <Animated.Text
          style={[
            styles.glyph,
            { fontSize: size, lineHeight: size * 1.05, color: "#B3261E" },
            filled,
          ]}
        >
          ♥
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tap: { alignItems: "center", justifyContent: "center" },
  layer: { alignItems: "center", justifyContent: "center" },
  glyph: { fontWeight: "500" },
  ring: {
    position: "absolute",
    borderWidth: 1,
  },
});
