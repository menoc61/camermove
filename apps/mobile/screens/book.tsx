import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PaymentStep } from "@/components/booking/payment-step";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createBooking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/resource";
import { getTrip } from "@/lib/api/trips";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { useBookingStore } from "@/lib/stores/booking";
import { validatePassenger } from "@/lib/validation";

function bookingErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return "Plus de places disponibles";
  if (e instanceof ApiError && e.status === 429) return "Trop de requêtes";
  if (e instanceof Error && e.message) return e.message;
  return "Échec de la réservation.";
}

export function BookScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const id = typeof tripId === "string" && tripId.length > 0 ? tripId : null;
  const accessToken = useAuthStore((s) => s.accessToken);
  const storedTripId = useBookingStore((s) => s.tripId);
  const seatCount = useBookingStore((s) => s.seatCount);
  const passengers = useBookingStore((s) => s.passengers);
  const setBooking = useBookingStore((s) => s.setBooking);

  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<{ id: string; reference: string } | null>(null);

  useEffect(() => {
    if (id && storedTripId !== id) {
      setCreated(null);
      setSubmitted(false);
      setBooking({ tripId: id, seatCount: 1, passengers: [{ fullName: "" }] });
    }
  }, [id, storedTripId, setBooking]);

  useEffect(() => {
    if (!accessToken && id) {
      router.replace(`/login?next=${encodeURIComponent(`/book/${id}`)}` as never);
    }
  }, [accessToken, id, router]);

  const tripQuery = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id as string),
    enabled: !!id,
  });

  const bookingMutation = useMutation({
    mutationFn: (input: { tripId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }) =>
      createBooking(input, accessToken as string),
    onSuccess: (data) => {
      setCreated({ id: data.booking.id, reference: data.booking.reference });
      toast("Réservation créée. Procédez au paiement.");
    },
    onError: (e) => {
      toast(bookingErrorMessage(e));
    },
  });

  if (!id) {
    return <EmptyState message="Trajet introuvable." actionLabel="Rechercher" onAction={() => router.push("/(tabs)/search")} />;
  }
  const currentTripId: string = id;

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour réserver ce trajet."
          actionLabel="Se connecter"
          onAction={() => router.push(`/login?next=${encodeURIComponent(`/book/${id}`)}` as never)}
        />
      </View>
    );
  }

  if (tripQuery.isPending) {
    return <LoadingState label="Chargement du récapitulatif…" />;
  }

  if (tripQuery.isError || !tripQuery.data) {
    return <ErrorState message="Impossible de charger ce trajet." onRetry={() => void tripQuery.refetch()} />;
  }

  const trip = tripQuery.data;
  const total = trip.price * seatCount;

  function setSeatCount(n: number) {
    const next = Math.min(10, Math.max(1, n));
    setBooking({
      seatCount: next,
      passengers: Array.from({ length: next }, (_, i) => passengers[i] ?? { fullName: "" }),
    });
  }

  function setPassenger(index: number, patch: { fullName?: string; phone?: string }) {
    setBooking({
      passengers: passengers.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  const errors = passengers.map((p) =>
    validatePassenger({ fullName: p.fullName, phone: !p.phone || p.phone.trim() === "" ? undefined : p.phone }),
  );
  const hasErrors = errors.some((e) => Object.keys(e).length > 0);

  function submit() {
    setSubmitted(true);
    if (hasErrors) {
      toast("Vérifiez les informations des passagers.");
      return;
    }
    if (bookingMutation.isPending) return;
    bookingMutation.mutate({
      tripId: currentTripId,
      seatCount,
      passengers: passengers.map((p) => ({
        fullName: p.fullName.trim(),
        phone: !p.phone || p.phone.trim() === "" ? undefined : p.phone.trim(),
      })),
    });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.eyebrow}>Réservation</Text>
      <Text style={styles.title}>
        {trip.route?.originCity ?? "—"} → {trip.route?.destinationCity ?? "—"}
      </Text>

      <Text style={styles.sectionTitle}>Nombre de places</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => setSeatCount(seatCount - 1)}
          disabled={seatCount <= 1}
          style={[styles.step, seatCount <= 1 && styles.stepDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Réduire le nombre de places"
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.count}>
          {seatCount} place{seatCount > 1 ? "s" : ""}
        </Text>
        <Pressable
          onPress={() => setSeatCount(seatCount + 1)}
          disabled={seatCount >= 10}
          style={[styles.step, seatCount >= 10 && styles.stepDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Augmenter le nombre de places"
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Passagers</Text>
      {passengers.map((p, i) => (
        <View key={i} style={styles.passenger}>
          <Text style={styles.passengerHead}>Passager {i + 1}</Text>
          <Field
            label="Nom complet"
            value={p.fullName}
            onChangeText={(t) => setPassenger(i, { fullName: t })}
            placeholder="ex : Amina Mbarga"
            autoCapitalize="words"
            error={submitted ? errors[i]?.fullName : undefined}
          />
          <Field
            label="Téléphone (optionnel)"
            value={p.phone ?? ""}
            onChangeText={(t) => setPassenger(i, { phone: t })}
            placeholder="+2376XXXXXXXX"
            keyboardType="phone-pad"
            error={submitted ? errors[i]?.phone : undefined}
          />
        </View>
      ))}

      <View style={styles.recap}>
        <Text style={styles.recapLabel}>
          {seatCount} place{seatCount > 1 ? "s" : ""} × {formatXAF(trip.price)}
        </Text>
        <Text style={styles.total}>{formatXAF(total)}</Text>
      </View>

      {bookingMutation.isError ? (
        <Text style={styles.error}>{bookingErrorMessage(bookingMutation.error)}</Text>
      ) : null}

      {created ? (
        <View style={styles.created}>
          <Text style={styles.createdLabel}>Réservation {created.reference} créée.</Text>
          <PaymentStep
            bookingId={created.id}
            amount={total}
            onPaid={() => router.push(`/book/confirmation?ref=${encodeURIComponent(created.reference)}` as never)}
          />
        </View>
      ) : (
        <View style={styles.cta}>
          <Button
            label={bookingMutation.isPending ? "Réservation…" : "Confirmer la réservation"}
            onPress={submit}
            disabled={bookingMutation.isPending}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  step: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: 22, color: colors.ink },
  count: { fontSize: 16, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  passenger: { marginTop: 8 },
  passengerHead: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  recap: {
    marginTop: 24,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  recapLabel: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  total: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, color: "#B3261E", marginTop: 12 },
  cta: { marginTop: 24 },
  created: { marginTop: 8 },
  createdLabel: { fontSize: 14, fontWeight: "500", color: colors.ink1 },
});
