import { ActivityIndicator, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "@/constants/theme";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  style?: ViewStyle;
  /** Accessible label for screen readers. */
  label?: string;
}

const SIZE_MAP: Record<SpinnerSize, number> = {
  sm: 14,
  md: 18,
  lg: 28,
};

/**
 * Inline spinner for button labels, badges, and action overlays.
 * Uses the platform spinner so it inherits native motion + theming.
 *
 * Use this when a discrete affordance needs to signal "in progress" without
 * pulling layout focus (e.g. inside a Button label or a chip after tap).
 * For list / card / detail loading, prefer `<SkeletonList>` or `<SkeletonHero>`.
 */
export function Spinner({
  size = "md",
  color = colors.ink,
  style,
  label = "Chargement…",
}: SpinnerProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <ActivityIndicator size={SIZE_MAP[size]} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});
