import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion, useReduceMotion } from "@/lib/motion";
import { colors } from "@/constants/theme";
import { Skeleton } from "./skeleton";

interface StatIndicatorProps {
  label: string;
  value: string;
  /** Optional description shown on press / focus in the tooltip popover. */
  tooltip?: string;
  /** When true, renders a skeleton block in place of the value. */
  loading?: boolean;
  /** Optional trend suffix (e.g. "+12%"). */
  trend?: "up" | "down" | "flat" | null;
  style?: ViewStyle;
}

/**
 * Compact metric tile with optional press-to-reveal tooltip. Used on Home for
 * the stats strip and anywhere a numeric KPI needs a short gloss.
 *
 * - Press → tooltip slides in below (256ms ease-out, snaps instantly when
 *   the user prefers reduced motion)
 * - Tooltip dismisses on next press anywhere
 * - Loading state renders a skeleton in place of the value
 */
export function StatIndicator({
  label,
  value,
  tooltip,
  loading,
  trend,
  style,
}: StatIndicatorProps) {
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: motion.duration.base });
  }, [open, progress, reduceMotion]);

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
    pointerEvents: progress.value > 0.5 ? "auto" : "none",
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ rotate: `${progress.value * 45}deg` }],
  }));

  return (
    <View style={[styles.cell, style]}>
      {loading ? (
        <Skeleton width={56} height={18} />
      ) : (
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {trend ? <TrendBadge trend={trend} /> : null}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${tooltip ? `, ${tooltip}` : ""}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((prev) => !prev)}
        style={styles.labelRow}
        hitSlop={6}
      >
        <Text style={styles.label}>{label}</Text>
        {tooltip ? (
          <Animated.Text style={[styles.caret, arrowStyle]}>+</Animated.Text>
        ) : null}
      </Pressable>
      {tooltip ? (
        <Animated.View style={[styles.tooltip, tooltipStyle]}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" }) {
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
  const color =
    trend === "up" ? colors.woodDark : trend === "down" ? "#B3261E" : colors.ink2;
  return <Text style={[styles.trend, { color }]}>{arrow}</Text>;
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  value: { fontSize: 16, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  trend: { fontSize: 10, fontWeight: "500" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  label: { fontSize: 11, color: colors.ink2, textAlign: "center" },
  caret: { fontSize: 11, color: colors.ink2, fontWeight: "500" },
  tooltip: {
    position: "absolute",
    top: "100%",
    left: 8,
    right: 8,
    marginTop: 4,
    padding: 10,
    backgroundColor: colors.ink,
    zIndex: 10,
  },
  tooltipText: { fontSize: 11, color: colors.paper, lineHeight: 15 },
});
