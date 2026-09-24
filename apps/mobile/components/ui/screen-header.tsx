import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
import { motion } from "@/lib/motion";

interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  showBack?: boolean;
  rightLabel?: string;
  onRightPress?: () => void;
}

/**
 * In-app header primitive used on every Stack screen. Replaces the OS-provided
 * navigation header (which is disabled in `app/_layout.tsx`) so that the
 * Swiss/Bauhaus square design language carries through navigation surfaces.
 *
 * - Slides in 12px from the top with `motion.duration.base` ease-out
 * - Title drops in 60ms later for a slight stagger
 * - Collapses instantly when reduce-motion is on
 * - Tap the title area to pop, or use the bottom title slot for context
 */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  showBack = true,
  rightLabel,
  onRightPress,
}: ScreenHeaderProps) {
  const router = useRouter();
  const translateY = useSharedValue(-12);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: motion.duration.base,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    opacity.value = withTiming(1, {
      duration: motion.duration.base,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {showBack ? (
        <Animated.Text
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          ← Retour
        </Animated.Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {rightLabel && onRightPress ? (
        <Animated.Text
          accessibilityRole="button"
          onPress={onRightPress}
          style={styles.rightAction}
        >
          {rightLabel}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
  },
  back: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    paddingVertical: 12,
    minHeight: 44,
  },
  spacer: { minHeight: 44 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "500",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 14, color: colors.ink1, marginTop: 4, lineHeight: 20 },
  rightAction: {
    position: "absolute",
    top: 24,
    right: 24,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 44,
  },
});
