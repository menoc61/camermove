import { useEffect } from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: TextStyle;
}

/**
 * Ticks a numeric value from 0 → value with a 480ms ease-out curve, formatted
 * with optional prefix/suffix/decimal places. Use for hero stats, fare
 * summaries, and trip counts so the digits animate in when the surface mounts.
 *
 * Reduce-motion: render the final value without animation.
 */
export function AnimatedCounter({
  value,
  durationMs = motion.duration.slow,
  prefix = "",
  suffix = "",
  decimals = 0,
  style,
}: AnimatedCounterProps) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const [display, setDisplay] = require("react").useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    tick();
  }, [value, durationMs, reduced, progress]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("fr-FR");

  return (
    <Animated.Text style={[styles.text, style]}>
      {prefix}
      {formatted}
      {suffix}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});
