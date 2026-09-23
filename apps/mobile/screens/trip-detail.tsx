import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { getTrip } from "@/lib/api/trips";
import { formatDate, formatRelative, formatTime, formatXAF, occupancy } from "@/lib/format";
import { deriveSeatMap, useLiveSeats } from "@/lib/seats";
import { useBookingStore } from "@/lib/stores/booking";
import { validatePassenger } from "@/lib/validation";

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = typeof id === "string" ? id : null;
  const setBooking = useBookingStore((s) => s.setBooking);

  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTrip(tripId as string),
    enabled: !!tripId,
  });
  const live = useLiveSeats(tripId);

  if (!tripId) {
    return <EmptyState message="Trajet introuvable." actionLabel="Rechercher" onAction={() => router.push("/(tabs)/search")} />;
  }

  if (tripQuery.isPending) {
    return <LoadingState label="Chargement du trajet…" />;
  }

  if (tripQuery.isError || !tripQuery.data) {
    return <ErrorState message="Trajet introuvable." onRetry={() => void tripQuery.refetch()} />;
  }

  const trip = tripQuery.data;
  const seatsAvailable = live?.seatsAvailable ?? trip.seatAvailability?.seatsAvailable ?? null;
  const soldOut = seatsAvailable === 0;
  const seats = deriveSeatMap(trip.totalSeats, seatsAvailable, picked);
  const rows = chunk(seats.map((state, i) => ({ state, n: i + 1 })), 4);

  const errors = validatePassenger({ fullName: name, phone: phone.trim() === "" ? undefined : phone });
  const showErrors = submitted;
  const canContinue =
    picked !== null && !soldOut && Object.keys(validatePassenger({ fullName: name, phone: phone.trim() === "" ? undefined : phone })).length === 0;

  function onContinue() {
    setSubmitted(true);
    const errs = validatePassenger({ fullName: name, phone: phone.trim() === "" ? undefined : phone });
    if (picked === null || soldOut || Object.keys(errs).length > 0) return;
    setBooking({
      tripId,
      seatCount: 1,
      passengers: [{ fullName: name.trim(), phone: phone.trim() === "" ? undefined : phone.trim() }],
    });
    router.push(`/book/${tripId}` as never);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.eyebrow}>{trip.transport?.companyName ?? "Transporteur"}</Text>
      <Text style={styles.title}>
        {trip.route?.originCity ?? "—"} → {trip.route?.destinationCity ?? "—"}
      </Text>
      <Text style={styles.meta}>
        {formatDate(trip.departureAt)} · {formatTime(trip.departureAt)} · {formatRelative(trip.departureAt)}
      </Text>
      {trip.vehicleTypeInfo ? <Text style={styles.vehicle}>{trip.vehicleTypeInfo}</Text> : null}

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatXAF(trip.price)}</Text>
        <Text style={styles.perPlace}>par place</Text>
      </View>

      <View style={styles.availability}>
        <Text style={[styles.seatsLeft, soldOut && styles.soldOut]}>
          {seatsAvailable === null
            ? `${trip.totalSeats} places`
            : soldOut
              ? "Complet"
              : seatsAvailable < 5
                ? `Plus que ${seatsAvailable}`
                : `${seatsAvailable} places libres`}
        </Text>
        <Text style={styles.occupancy}>{occupancy(trip.totalSeats, seatsAvailable ?? trip.totalSeats)}% occupé</Text>
      </View>

      <Text style={styles.sectionTitle}>Choisissez votre siège</Text>
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map(({ state, n }) => {
              const taken = state === "taken";
              const held = state === "held";
              return (
                <Pressable
                  key={n}
                  disabled={taken}
                  onPress={() => setPicked((p) => (p === n ? null : n))}
                  style={[styles.seat, taken && styles.seatTaken, held && styles.seatHeld]}
                  accessibilityRole="button"
                  accessibilityLabel={`Siège ${n}${taken ? ", occupé" : held ? ", sélectionné" : ", libre"}`}
                  accessibilityState={{ disabled: taken, selected: held }}
                >
                  <Text style={[styles.seatText, taken && styles.seatTextTaken, held && styles.seatTextHeld]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendItem}>■ Libre</Text>
        <Text style={styles.legendItem}>■ Occupé</Text>
        <Text style={styles.legendItem}>■ Sélectionné</Text>
      </View>

      <Text style={styles.sectionTitle}>Passager</Text>
      <Field
        label="Nom complet"
        value={name}
        onChangeText={setName}
        placeholder="ex : Amina Mbarga"
        autoCapitalize="words"
        error={showErrors ? errors.fullName : undefined}
      />
      <Field
        label="Téléphone (optionnel)"
        value={phone}
        onChangeText={setPhone}
        placeholder="+2376XXXXXXXX"
        keyboardType="phone-pad"
        error={showErrors ? errors.phone : undefined}
      />

      <View style={styles.cta}>
        <Button
          label={soldOut ? "Complet" : picked === null ? "Sélectionnez un siège" : "Continuer"}
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink },
  meta: { fontSize: 14, color: colors.ink1, marginTop: 8, fontVariant: ["tabular-nums"] },
  vehicle: { fontSize: 13, color: colors.ink2, marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 16 },
  price: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  perPlace: { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: colors.ink2 },
  availability: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  seatsLeft: { fontSize: 14, fontWeight: "500", color: colors.ink1 },
  soldOut: { color: "#B3261E" },
  occupancy: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 28, marginBottom: 12 },
  grid: { gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  seat: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  seatTaken: { backgroundColor: colors.surface3, opacity: 0.6 },
  seatHeld: { backgroundColor: colors.ink, borderColor: colors.ink },
  seatText: { fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  seatTextTaken: { color: colors.ink2 },
  seatTextHeld: { color: colors.paper, fontWeight: "500" },
  legend: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { fontSize: 12, color: colors.ink2 },
  cta: { marginTop: 24 },
});
