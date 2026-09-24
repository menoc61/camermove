import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { SuccessCheckmark } from "@/components/ui/success-checkmark";
import { LottieIllustration } from "@/components/ui/lottie-illustration";
import { IconButton } from "@/components/ui/icon-button";
import { colors } from "@/constants/theme";
import { getBooking } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/session";
import { formatCountdown, formatXAF } from "@/lib/format";

interface NormalizedBooking {
  reference: string;
  holdExpiresAt: string | null;
  totalAmount: number | null;
  status: string;
  seatCount: number | null;
}

function normalizeBooking(raw: unknown): NormalizedBooking | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const inner = (record.booking && typeof record.booking === "object"
    ? (record.booking as Record<string, unknown>)
    : record) as Record<string, unknown>;
  const reference = typeof inner.reference === "string" ? inner.reference : null;
  if (!reference) return null;
  const holdExpiresAt =
    typeof inner.holdExpiresAt === "string"
      ? inner.holdExpiresAt
      : typeof record.holdExpiresAt === "string"
        ? (record.holdExpiresAt as string)
        : null;
  const totalAmount =
    typeof inner.totalAmount === "number"
      ? inner.totalAmount
      : typeof record.totalAmount === "number"
        ? (record.totalAmount as number)
        : null;
  const status = typeof inner.status === "string" ? inner.status : "—";
  const passengers = (inner as { passengers?: unknown }).passengers;
  const seatCount =
    typeof inner.seatCount === "number"
      ? inner.seatCount
      : typeof (inner as { seats?: unknown }).seats === "number"
        ? ((inner as { seats: number }).seats)
        : Array.isArray(passengers)
          ? passengers.length
          : null;
  return { reference, holdExpiresAt, totalAmount, status, seatCount };
}

export function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const ref = typeof params.ref === "string" && params.ref.length > 0 ? params.ref : null;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [now, setNow] = useState(() => Date.now());
  const fallbackExpiry = useRef(Date.now() + 600_000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bookingQuery = useQuery({
    queryKey: ["booking", ref],
    queryFn: () => getBooking(ref as string, accessToken as string),
    enabled: !!ref && !!accessToken,
    retry: false,
  });

  if (!ref) {
    return (
      <EmptyState
        message="Référence de réservation manquante."
        actionLabel="Rechercher un trajet"
        onAction={() => router.push("/(tabs)/search")}
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
            router.push(`/login?next=${encodeURIComponent(`/book/confirmation?ref=${ref}`)}` as never)
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
            <SkeletonText lines={3} />
          </View>
        </View>
      </View>
    );
  }

  if (bookingQuery.isError || !normalizeBooking(bookingQuery.data)) {
    return (
      <ErrorState message="Impossible de charger cette réservation." onRetry={() => void bookingQuery.refetch()} />
    );
  }

  const booking = normalizeBooking(bookingQuery.data) as NormalizedBooking;
  const expiry = booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : fallbackExpiry.current;
  const remaining = Number.isFinite(expiry) ? expiry - now : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Reveal>
        <View style={styles.heroBlock}>
          <SuccessCheckmark size={64} />
          <LottieIllustration preset="ticket" size={64} tint={colors.ink} />
          <Text style={styles.eyebrow}>Réservation confirmée</Text>
          <Text style={styles.title}>Merci !</Text>
        </View>
        <View style={styles.shareRow}>
          <IconButton
            name="share"
            variant="ghost"
            accessibilityLabel="Partager la référence"
            onPress={() => router.push(`/tickets/lookup?ref=${encodeURIComponent(booking.reference)}` as never)}
          />
          <IconButton
            name="favorite"
            variant="ghost"
            accessibilityLabel="Ajouter aux favoris"
            onPress={() => router.push("/(tabs)/account" as never)}
          />
        </View>
      </Reveal>

      <Reveal delay={80} direction="up" distance={20}>
        <View style={styles.card}>
          <Text style={styles.label}>Référence</Text>
          <Text selectable style={styles.reference}>
            {booking.reference}
          </Text>
          <Text style={styles.row}>
            Statut : <Text style={styles.strong}>{booking.status}</Text>
          </Text>
          <Text style={styles.row}>
            Places : <Text style={styles.strong}>{booking.seatCount ?? "—"}</Text>
          </Text>
          <Text style={styles.row}>
            Total :{" "}
            <Text style={styles.strong}>{booking.totalAmount !== null ? formatXAF(booking.totalAmount) : "—"}</Text>
          </Text>
          <Text style={styles.countdown}>Temps restant : {formatCountdown(remaining)}</Text>
        </View>
      </Reveal>

      <Reveal delay={160}>
        <View style={styles.ctas}>
          <ActionButton
            label="Voir le billet"
            onPress={() => router.push(`/tickets/lookup?ref=${encodeURIComponent(booking.reference)}` as never)}
            successLabel="Ouverture…"
          />
          <AnimatedPressFeedback
            onPress={() => router.push("/(tabs)/account" as never)}
            accessibilityRole="link"
            accessibilityLabel="Aller à mes réservations"
            style={styles.secondaryPressable}
          >
            <Text style={styles.secondary}>Mes réservations</Text>
          </AnimatedPressFeedback>
        </View>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  heroBlock: {
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  shareRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  reference: { fontSize: 18, fontWeight: "500", letterSpacing: 1.2, color: colors.ink, marginBottom: 4 },
  row: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  strong: { fontWeight: "500", color: colors.ink },
  countdown: { fontSize: 14, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"], marginTop: 8 },
  ctas: { gap: 12, marginTop: 24 },
  secondaryPressable: { paddingVertical: 12, minHeight: 44, alignItems: "center" },
  secondary: { fontSize: 14, color: colors.woodDark, textAlign: "center" },
});
