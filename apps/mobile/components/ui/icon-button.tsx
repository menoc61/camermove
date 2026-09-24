import * as Haptics from "expo-haptics";
import { StyleSheet, Text, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion, useReduceMotion } from "@/lib/motion";

type IconName =
  | "arrow-back"
  | "arrow-forward"
  | "search"
  | "filter"
  | "share"
  | "favorite"
  | "favorite-filled"
  | "calendar"
  | "check"
  | "close"
  | "menu"
  | "phone"
  | "mail"
  | "plus"
  | "minus"
  | "refresh"
  | "info"
  | "warning"
  | "home"
  | "ticket"
  | "user"
  | "truck";

interface IconButtonProps {
  name: IconName;
  onPress?: () => void;
  size?: number;
  variant?: "primary" | "ghost" | "subtle";
  accessibilityLabel: string;
  disabled?: boolean;
  style?: ViewStyle;
  /** Force-filled state (e.g. heart when already favorited). */
  filled?: boolean;
}

const GLYPH: Record<IconName, string> = {
  "arrow-back": "←",
  "arrow-forward": "→",
  search: "⌕",
  filter: "≡",
  share: "↗",
  favorite: "♡",
  "favorite-filled": "♥",
  calendar: "▦",
  check: "✓",
  close: "×",
  menu: "≡",
  phone: "☎",
  mail: "✉",
  plus: "+",
  minus: "−",
  refresh: "↻",
  info: "i",
  warning: "▲",
  home: "▣",
  ticket: "▭",
  user: "○",
  truck: "▥",
};

/**
 * Compact square icon button with press-scale and rotate-on-tap animations.
 *
 * - Default press: 0.96x scale (160ms)
 * - Tap feedback for share/favorite: small rotate wobble
 * - Haptic on press (light impact, suppressed under reduce-motion)
 */
export function IconButton({
  name,
  onPress,
  size = 44,
  variant = "subtle",
  accessibilityLabel,
  disabled,
  style,
  filled,
}: IconButtonProps) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  function press() {
    if (disabled) return;
    if (!reduced) {
      scale.value = withSequence(
        withTiming(0.92, { duration: motion.duration.fast }),
        withSpring(1, { damping: 14, stiffness: 280 }),
      );
      if (name === "share" || name === "refresh") {
        rotate.value = withSequence(
          withTiming(0.2, { duration: motion.duration.fast }),
          withSpring(0, { damping: 14, stiffness: 220 }),
        );
      }
      if (name === "favorite" || name === "favorite-filled") {
        rotate.value = withSequence(
          withTiming(0.15, { duration: motion.duration.fast }),
          withSpring(0, { damping: 12, stiffness: 240 }),
        );
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress?.();
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}rad` }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Text
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected: filled }}
        onPress={press}
        style={[
          styles.base,
          {
            width: size,
            height: size,
            fontSize: Math.round(size * 0.46),
            lineHeight: Math.round(size * 0.56),
          },
          variant === "primary" && styles.primary,
          variant === "ghost" && styles.ghost,
          variant === "subtle" && styles.subtle,
          disabled && styles.disabled,
          filled && styles.filled,
        ]}
      >
        {filled ? GLYPH["favorite-filled"] : GLYPH[name]}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    textAlign: "center",
    textAlignVertical: "center",
    color: colors.ink,
  },
  primary: { backgroundColor: colors.ink, color: colors.paper },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.ink, color: colors.ink },
  subtle: { backgroundColor: colors.surface2, color: colors.ink },
  filled: { color: "#B3261E" },
  disabled: { opacity: 0.4 },
});
