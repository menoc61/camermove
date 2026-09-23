import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { formatDate, formatRelative, formatTime, formatXAF, occupancy } from "@/lib/format";
import type { SearchResultItem } from "@/lib/api/search";

export type TripHighlight = "best_price" | null;

export function TripCard({ trip, highlight = null }: { trip: SearchResultItem; highlight?: TripHighlight }) {
  const seatsLeft = trip.seatsAvailable;
  const pct = occupancy(trip.totalSeats, trip.seatsAvailable);
  const urgency =
    seatsLeft === 0 ? "Complet" : seatsLeft < 5 ? `Plus que ${seatsLeft}` : `${seatsLeft} places libres`;
  const urgent = seatsLeft >= 0 && seatsLeft < 5;

  return (
    <Link href={`/trips/${trip.id}`} asChild>
      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${trip.companyName}, départ ${formatTime(trip.departureAt)}, ${formatXAF(trip.price)}`}
      >
        <View style={styles.top}>
          <View style={styles.carrier}>
            <Text style={styles.company} numberOfLines={1}>
              {trip.companyName}
            </Text>
            {trip.vehicleTypeInfo ? (
              <Text style={styles.vehicle} numberOfLines={1}>
                {trip.vehicleTypeInfo}
              </Text>
            ) : null}
          </View>
          {highlight === "best_price" ? <Text style={styles.badge}>Meilleur prix</Text> : null}
        </View>

        <View style={styles.middle}>
          <Text style={styles.time}>{formatTime(trip.departureAt)}</Text>
          <View style={styles.routeLine} aria-hidden>
            <View style={styles.dot} />
            <View style={styles.line} />
            <View style={[styles.dot, styles.dotDim]} />
          </View>
          <Text style={styles.date}>{formatDate(trip.departureAt)}</Text>
        </View>
        <Text style={styles.relative}>{formatRelative(trip.departureAt)}</Text>

        <View style={styles.bottom}>
          <Text style={[styles.seats, urgent && styles.seatsUrgent]}>{urgency}</Text>
          {trip.totalSeats > 0 ? (
            <View style={styles.occupancy}>
              <View style={styles.bar}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.pct}>{pct}%</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatXAF(trip.price)}</Text>
          <Text style={styles.perPlace}>par place</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  carrier: { flex: 1, marginRight: 8 },
  company: { fontSize: 16, fontWeight: "500", color: colors.ink },
  vehicle: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  badge: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.woodDark,
    borderWidth: 1,
    borderColor: colors.woodDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  middle: { flexDirection: "row", alignItems: "center", gap: 12 },
  time: { fontSize: 24, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  routeLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, backgroundColor: colors.ink },
  dotDim: { backgroundColor: colors.ink2 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  date: { fontSize: 13, color: colors.ink1, fontVariant: ["tabular-nums"] },
  relative: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 4,
  },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  seats: { fontSize: 13, color: colors.ink2 },
  seatsUrgent: { color: "#B3261E", fontWeight: "500" },
  occupancy: { flexDirection: "row", alignItems: "center", gap: 6 },
  bar: { width: 64, height: 4, backgroundColor: colors.surface3 },
  fill: { height: "100%", backgroundColor: colors.ink },
  pct: { fontSize: 11, color: colors.ink2, fontVariant: ["tabular-nums"] },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  price: { fontSize: 20, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  perPlace: { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: colors.ink2 },
});
