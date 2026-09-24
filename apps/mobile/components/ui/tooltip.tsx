import { useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

interface TooltipProps {
  /** Visible label of the trigger. */
  label: string;
  /** Tooltip body. */
  body: string;
  /** Optional children wrap a custom trigger; falls back to label button. */
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Side of the trigger to render the tooltip. */
  side?: "top" | "bottom";
}

/**
 * Long-press or tap-to-pin tooltip with Swiss/Bauhaus square geometry.
 *
 * - Hover/long-press shows the popover instantly with a 4px slide-in
 * - Reduce-motion: instant
 * - Tapping anywhere else collapses it
 */
export function Tooltip({ label, body, children, style, side = "top" }: TooltipProps) {
  const reduced = useReduceMotion();
  const [pinned, setPinned] = useState(false);
  const progress = useSharedValue(0);

  function show() {
    progress.value = withTiming(1, {
      duration: reduced ? 0 : motion.duration.fast,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }
  function hide() {
    if (pinned) return;
    progress.value = withTiming(0, { duration: reduced ? 0 : motion.duration.fast });
  }
  function toggle() {
    if (pinned) {
      setPinned(false);
      hide();
    } else {
      setPinned(true);
      show();
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY:
          side === "top" ? (1 - progress.value) * 6 : (progress.value - 1) * 6,
      },
    ],
  }));

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={toggle}
        onLongPress={show}
        onPressIn={show}
        onPressOut={() => !pinned && hide()}
        delayLongPress={250}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${body}`}
        accessibilityHint="Appui long pour plus d'informations"
      >
        {children ?? <Text style={styles.trigger}>{label}</Text>}
      </Pressable>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tooltip,
          side === "top" ? styles.tooltipTop : styles.tooltipBottom,
          animatedStyle,
        ]}
      >
        <Text style={styles.tooltipBody}>{body}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", alignSelf: "flex-start" },
  trigger: {
    fontSize: 14,
    color: colors.ink,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  tooltip: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.ink,
    zIndex: 20,
  },
  tooltipTop: { bottom: "100%", marginBottom: 8 },
  tooltipBottom: { top: "100%", marginTop: 8 },
  tooltipBody: { color: colors.paper, fontSize: 12, lineHeight: 16 },
});
