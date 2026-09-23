import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { colors } from "@/constants/theme";
import { fetchRentalBooking } from "@/lib/api/rentals";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { motion, useReduceMotion } from "@/lib/motion";

function firstString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function RentalConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = firstString(params.id);
  const accessToken = useAuthStore((s) => s.accessToken);

  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  // Re-run on mount only; `reduceMotion` change while mounted is a no-op.
  const mountedOnce = useRef(false);
  useEffect(() => {
    if (mountedOnce.current) return;
    mountedOnce.current = true;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: motion.duration.base });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.95 + 0.05 * progress.value }],
  }));

  useEffect(() => {
    if (!accessToken && id) {
      router.replace(`/login?next=${encodeURIComponent(`/rentals/confirmation?id=${id}`)}` as never);
    }
  }, [accessToken, id, router]);

  const bookingQuery = useQuery({
    queryKey: ["rental-booking", id],
    queryFn: () => fetchRentalBooking(accessToken as string, id),
    enabled: !!accessToken && !!id,
    retry: false,
  });

  if (!id) {
    return (
      <EmptyState
        message="Référence manquante."
        actionLabel="Voir les locations"
        onAction={() => router.push("/rentals")}
      />
    );
  }

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour voir cette confirmation."
          actionLabel="Se connecter"
          onAction={() =>
            router.push(`/login?next=${encodeURIComponent(`/rentals/confirmation?id=${id}`)}` as never)
          }
        />
      </View>
    );
  }

  if (bookingQuery.isPending) {
    return <LoadingState label="Chargement de la réservation…" />;
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger cette réservation."
        onRetry={() => void bookingQuery.refetch()}
      />
    );
  }

  const booking = bookingQuery.data;
  const pendingPayment =
    booking.status === "pending_payment" || booking.status === "pending";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Animated.View style={[styles.successBlock, animatedStyle]}>
        <View style={styles.successMark}>
          <Text style={styles.successMarkText}>✓</Text>
        </View>
        <Text style={styles.eyebrow}>Location créée</Text>
        <Text style={styles.title}>Merci !</Text>
        <Text selectable style={styles.reference}>
          Réf. {booking.id}
        </Text>
      </Animated.View>

      <View style={styles.card}>
        <Text style={styles.row}>
          <Text style={styles.strong}>Véhicule :</Text>{" "}
          {booking.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : "—"}
          {booking.vehicle?.category ? ` · ${booking.vehicle.category}` : ""}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Début :</Text> {formatDay(booking.startDate)}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Fin :</Text> {formatDay(booking.endDate)}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Retrait :</Text> {booking.pickupCity}
        </Text>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatXAF(booking.totalAmount)}</Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Statut :</Text> {booking.status}
        </Text>

        {pendingPayment && booking.vehicle ? (
          <View style={styles.cta}>
            <Button
              label="Procéder au paiement"
              onPress={() => router.push(`/rentals/${booking.vehicle!.id}` as never)}
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/(tabs)/account" as never)}
          accessibilityRole="button"
          accessibilityLabel="Aller au tableau de bord"
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Aller à mon compte →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  successBlock: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  successMark: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  successMarkText: { color: colors.paper, fontSize: 28, fontWeight: "500" },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 12,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink },
  reference: {
    fontSize: 13,
    color: colors.ink2,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  row: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  strong: { fontWeight: "500", color: colors.ink },
  totalLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 12,
  },
  total: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  cta: { marginTop: 12 },
  secondary: {
    marginTop: 16,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 14, color: colors.woodDark },
});
