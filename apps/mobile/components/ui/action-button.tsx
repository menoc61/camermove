import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion, useReduceMotion } from "@/lib/motion";
import { colors } from "@/constants/theme";

export type ActionButtonState = "idle" | "loading" | "success" | "error";

interface ActionButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  /** When true, shows the inline spinner and blocks re-press. */
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  /** Optional success copy shown for 1.2s before resetting to idle. */
  successLabel?: string;
  style?: ViewStyle;
}

/**
 * Primary CTA with three states: idle / loading / success.
 *
 * - Idle: solid ink background, paper text, eyebrow typography
 * - Loading: spinner replaces the label (button stays pressable to cancel
 *   in the future; currently disabled to avoid double-submit)
 * - Success: short feedback label + subtle scale-up animation, then resets
 *
 * Always fires an Impact haptic on press (unless reduced motion is on) and
 * applies a 0.97 pressed-scale animation.
 */
export function ActionButton({
  label,
  onPress,
  loading: loadingProp,
  variant = "primary",
  disabled,
  successLabel,
  style,
}: ActionButtonProps) {
  const reduceMotion = useReduceMotion();
  const [state, setState] = useState<ActionButtonState>("idle");
  const pressed = useSharedValue(0);

  const isLoading = loadingProp ?? state === "loading";
  const isSuccess = state === "success";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    opacity: pressed.value > 0 ? 0.92 : 1,
  }));

  async function handlePress() {
    if (isLoading || disabled) return;
    if (!reduceMotion) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = onPress();
      if (result && typeof (result as Promise<void>).then === "function") {
        setState("loading");
        await result;
      }
      if (successLabel) {
        setState("success");
        setTimeout(() => setState("idle"), 1200);
      }
    } catch (err) {
      if (!reduceMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  }

  return (
    <Animated.View
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        (disabled || isLoading) && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: motion.duration.fast });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: motion.duration.fast });
        }}
        disabled={disabled || isLoading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
        accessibilityLabel={isSuccess && successLabel ? successLabel : label}
        style={styles.pressable}
      >
        {isLoading ? (
          <View style={styles.contentRow}>
            <ActivityIndicator size="small" color={variant === "primary" ? colors.paper : colors.ink} />
            <Text style={[styles.label, variant === "ghost" && styles.labelGhost]}>
              {label}…
            </Text>
          </View>
        ) : isSuccess && successLabel ? (
          <Text style={[styles.label, variant === "ghost" && styles.labelGhost]}>
            {successLabel}
          </Text>
        ) : (
          <Text style={[styles.label, variant === "ghost" && styles.labelGhost]}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.ink },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.ink },
  danger: { backgroundColor: "#B3261E" },
  disabled: { opacity: 0.5 },
  pressable: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  contentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.paper,
    textAlign: "center",
  },
  labelGhost: { color: colors.ink },
});
