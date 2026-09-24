import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { Spinner } from "@/components/ui/spinner";
import { colors } from "@/constants/theme";
import { getHotelBooking, type HotelBookingDetail } from "@/lib/api/hotels";
import { useAuthStore } from "@/lib/auth/session";
import { formatCountdown, formatXAF } from "@/lib/format";
import { motion, useReduceMotion } from "@/lib/motion";

function SuccessBlock({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const reduced = useReduceMotion();

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: reduced ? 0 : motion.duration.base,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    opacity.value = withTiming(1, {
      duration: reduced ? 0 : motion.duration.base,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [scale, opacity, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.success, style]}>{children}</Animated.View>;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function HotelConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : null;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [now, setNow] = useState(() => Date.now());
  const fallbackExpiry = useRef(Date.now() + 600_000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bookingQuery = useQuery({
    queryKey: ["hotel-booking", id],
    queryFn: () => getHotelBooking(accessToken as string, id as string),
    enabled: !!id && !!accessToken,
    retry: false,
  });

  if (!id) {
    return (
      <EmptyState
        message="Référence de réservation manquante."
        actionLabel="Voir les hôtels"
        onAction={() => router.push("/hotels")}
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
            router.push(`/login?next=${encodeURIComponent(`/hotels/confirmation?id=${id}`)}` as never)
          }
        />
      </View>
    );
  }

  if (bookingQuery.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonHero />
          <View style={{ marginTop: 16 }}>
            <SkeletonText lines={5} />
          </View>
        </View>
      </View>
    );
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger cette réservation."
        onRetry={() => void bookingQuery.refetch()}
      />
    );
  }

  const booking: HotelBookingDetail = bookingQuery.data;
  // Hotels don't expose a holdExpiresAt on the GET shape; show a 10-minute
  // informational countdown for parity with the trips confirmation screen.
  const remaining = Math.max(0, fallbackExpiry.current - now);
  const pendingPayment = booking.status === "pending_payment" || booking.status === "pending";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SuccessBlock>
        <Text style={styles.successEyebrow}>Réservation créée</Text>
        <Text style={styles.successTitle}>Merci !</Text>
        <Text selectable style={styles.reference}>
          {booking.id}
        </Text>
      </SuccessBlock>

      <View style={styles.card}>
        {booking.hotel ? (
          <Text style={styles.row}>
            <Text style={styles.strong}>Hôtel :</Text> {booking.hotel.name}
            {booking.hotel.city ? ` · ${booking.hotel.city}` : ""}
          </Text>
        ) : null}
        {booking.roomType ? (
          <Text style={styles.row}>
            <Text style={styles.strong}>Chambre :</Text> {booking.roomType.name}
          </Text>
        ) : null}
        <Text style={styles.row}>
          <Text style={styles.strong}>Arrivée :</Text> {formatDateFr(booking.checkIn)}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Départ :</Text> {formatDateFr(booking.checkOut)}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Voyageurs :</Text> {booking.guests}
        </Text>
        <Text style={styles.total}>
          <Text style={styles.strong}>Total :</Text> {formatXAF(booking.totalAmount)}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.strong}>Statut :</Text> {booking.status}
        </Text>
        {remaining > 0 ? (
          <Text style={styles.countdown}>
            Délai de paiement : {formatCountdown(remaining)}
          </Text>
        ) : null}
      </View>

      <View style={styles.ctas}>
        {pendingPayment && booking.hotel?.id ? (
          <ActionButton
            label="Procéder au paiement"
            onPress={() =>
              router.push(`/hotels/${encodeURIComponent(booking.hotel!.id)}` as never)
            }
          />
        ) : null}
        <AnimatedPressFeedback
          onPress={() => router.push("/(tabs)/account" as never)}
          accessibilityRole="button"
          accessibilityLabel="Voir mes réservations"
        >
          <Text style={styles.secondary}>Voir mes réservations</Text>
        </AnimatedPressFeedback>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  success: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 24,
    gap: 8,
  },
  successEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  successTitle: { fontSize: 32, fontWeight: "500", color: colors.ink },
  reference: {
    fontSize: 14,
    color: colors.ink2,
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
  },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  row: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  strong: { fontWeight: "500", color: colors.ink },
  total: { fontSize: 18, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"], marginTop: 8 },
  countdown: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.woodDark,
    fontVariant: ["tabular-nums"],
    marginTop: 8,
  },
  ctas: { gap: 12, marginTop: 24 },
  secondary: { fontSize: 14, color: colors.woodDark, textAlign: "center", paddingVertical: 12 },
});
