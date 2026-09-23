import { StyleSheet, View, type ViewStyle } from "react-native";
import { Skeleton } from "./skeleton";
import { colors } from "@/constants/theme";

interface SkeletonRowProps {
  count?: number;
  spacing?: number;
  style?: ViewStyle;
}

/**
 * Vertical stack of skeleton rows matching the eyebrow + title + meta pattern
 * used across list screens (agencies, hotels, rentals, etc.).
 */
export function SkeletonList({ count = 4, spacing = 12, style }: SkeletonRowProps) {
  return (
    <View style={[{ gap: spacing }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} delay={i * 60} />
      ))}
    </View>
  );
}

/**
 * Card-shaped skeleton that mirrors the eyebrow + title + body + price layout
 * used by the agency/hotel/rental cards on Home + list screens.
 */
export function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton height={56} style={styles.brandBar} />
      <View style={styles.body}>
        <Skeleton width="40%" height={10} style={styles.meta} />
        <Skeleton width="80%" height={16} style={{ marginTop: 8 }} />
        <Skeleton width="65%" height={12} style={styles.meta} />
        <View style={styles.row}>
          <Skeleton width={72} height={18} />
          <Skeleton width={48} height={12} style={styles.meta} />
        </View>
      </View>
      {delay > 0 ? <View style={{ height: 0 }} /> : null}
    </View>
  );
}

/**
 * Compact stat-block skeleton for the Home stats row.
 */
export function SkeletonStats() {
  return (
    <View style={styles.statsRow}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.statCell}>
          <Skeleton width={56} height={14} />
          <Skeleton width={36} height={9} style={styles.meta} />
        </View>
      ))}
    </View>
  );
}

/**
 * Horizontal rail of compact card skeletons (Home rails).
 */
export function SkeletonRail({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.railCard}>
          <Skeleton width="50%" height={9} />
          <Skeleton width="80%" height={16} style={styles.meta} />
          <Skeleton width="60%" height={11} style={styles.meta} />
          <Skeleton width="40%" height={14} style={styles.meta} />
          <Skeleton width="70%" height={9} style={styles.meta} />
        </View>
      ))}
    </View>
  );
}

/**
 * Hero block skeleton for detail screens (hotel/rental/agency detail).
 */
export function SkeletonHero() {
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width="30%" height={10} style={styles.meta} />
      <Skeleton width="80%" height={28} style={styles.metaLg} />
      <Skeleton width="60%" height={13} style={styles.meta} />
      <View style={[styles.row, styles.heroFoot]}>
        <Skeleton width={64} height={32} />
        <Skeleton width={96} height={32} />
      </View>
    </View>
  );
}

/**
 * List of paragraph-style rows (about sections, descriptions).
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textCol}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={12}
          style={styles.meta}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
  },
  brandBar: { borderBottomWidth: 1, borderBottomColor: colors.line },
  body: { padding: 16 },
  meta: { marginTop: 8 },
  metaLg: { marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
  },
  statCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  rail: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 24,
  },
  railCard: {
    width: 240,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
  },
  hero: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
  },
  heroFoot: { marginTop: 24 },
  textCol: { gap: 4 },
});
