import { Image } from "expo-image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { ActionButton } from "@/components/ui/action-button";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createReview } from "@/lib/api/reviews";
import { getTicketDetail } from "@/lib/api/tickets";
import { useAuthStore } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/format";
import { motion } from "@/lib/motion";

function addMinutes(iso: string, offsetMinutes: number): string {
  return new Date(new Date(iso).getTime() + offsetMinutes * 60000).toISOString();
}

function RatingForm({
  token,
  tripId,
  bookingId,
}: {
  token: string;
  tripId: string;
  bookingId: string;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = useMutation({ mutationFn: () => createReview(token, { target: "trip", tripId, bookingId, rating, comment: comment.trim() || undefined }) });

  async function submit() {
    if (mutation.isPending) return;
    if (rating < 1 || rating > 5) {
      toast("Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    try {
      await mutation.mutateAsync();
      setSent(true);
      toast("Merci pour votre avis.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'envoi de l'avis.");
    }
  }

  if (sent) return <Text style={styles.ratingDone}>Avis envoyé. Merci !</Text>;

  return (
    <View style={styles.rating}>
      <Text style={styles.sectionTitle}>Noter ce voyage</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <AnimatedPressFeedback
            key={n}
            onPress={() => setRating(n)}
            style={styles.star}
            accessibilityRole="button"
            accessibilityLabel={`Noter ${n} sur 5`}
          >
            <Text style={[styles.starText, n <= rating && styles.starActive]}>
              {n <= rating ? "★" : "☆"}
            </Text>
          </AnimatedPressFeedback>
        ))}
      </View>
      <Field
        label="Commentaire (facultatif)"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
        maxLength={2000}
        placeholder="Racontez votre voyage…"
      />
      <View style={styles.cta}>
        <ActionButton
          label={mutation.isPending ? "Envoi…" : "Envoyer mon avis"}
          onPress={submit}
          disabled={mutation.isPending}
          successLabel="Merci pour votre avis"
        />
      </View>
    </View>
  );
}

export function TicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => getTicketDetail(accessToken as string, id as string),
    enabled: !!accessToken && typeof id === "string",
  });

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour voir ce billet."
          actionLabel="Se connecter"
          onAction={() => router.push("/login")}
        />
      </View>
    );
  }
  if (ticketQuery.isPending)
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
  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger ce billet."
        onRetry={() => void ticketQuery.refetch()}
      />
    );
  }

  const ticket = ticketQuery.data;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.brandBand, { backgroundColor: ticket.agency.brandColor || colors.ink }]}>
        <Text style={styles.brandName}>{ticket.agency.companyName}</Text>
        {ticket.agency.tagline ? <Text style={styles.brandTag}>{ticket.agency.tagline}</Text> : null}
      </View>
      {ticket.agency.phone ? (
        <Text style={styles.phone} onPress={() => void Linking.openURL(`tel:${ticket.agency.phone}`)}>
          Appeler l'agence : {ticket.agency.phone}
        </Text>
      ) : null}

      <Text style={styles.hero}>
        {ticket.trip.origin} → {ticket.trip.destination}
      </Text>
      <Text style={styles.heroMeta}>
        {formatDate(ticket.trip.departureAt)} · {formatTime(ticket.trip.departureAt)}
        {ticket.trip.arrivalAt ? ` — ${formatTime(ticket.trip.arrivalAt)}` : ""}
      </Text>

      <View style={styles.qrBox}>
        {ticket.qrDataUrl ? (
          <Image
            source={{ uri: ticket.qrDataUrl }}
            style={styles.qr}
            contentFit="contain"
            accessibilityLabel="QR du billet"
          />
        ) : (
          <Text style={styles.qrMissing}>QR indisponible</Text>
        )}
        <Text selectable style={styles.code}>
          {ticket.verificationCode}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Passagers</Text>
      {ticket.passengers.map((p, i) => (
        <View key={`${p.firstName}-${p.lastName}-${i}`} style={styles.row}>
          <Text style={styles.rowText}>
            {p.firstName} {p.lastName}
          </Text>
          <Text style={styles.seatBadge}>{p.seatNumber}</Text>
        </View>
      ))}

      {ticket.boardingStop ? (
        <Text style={styles.stop}>
          Embarquement : {ticket.boardingStop.name} · {formatTime(addMinutes(ticket.trip.departureAt, ticket.boardingStop.offsetMinutes))}
        </Text>
      ) : null}
      {ticket.dropOffStop ? (
        <Text style={styles.stop}>
          Dépose : {ticket.dropOffStop.name}
          {ticket.trip.arrivalAt
            ? ` · ${formatTime(addMinutes(ticket.trip.arrivalAt, ticket.dropOffStop.offsetMinutes))}`
            : ""}
        </Text>
      ) : null}

      <RatingForm
        token={accessToken}
        tripId={ticket.ratingContext.tripId}
        bookingId={ticket.ratingContext.bookingId}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  guard: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  cta: { marginTop: 16 },
  brandBand: { padding: 16, marginBottom: 12, borderRadius: 0 },
  brandName: { fontSize: 20, fontWeight: "500", color: "#FFFFFF" },
  brandTag: { fontSize: 13, color: "#FFFFFF", marginTop: 4, opacity: 0.9 },
  phone: { fontSize: 14, color: colors.woodDark, marginBottom: 16 },
  hero: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  heroMeta: { fontSize: 15, color: colors.ink2, marginBottom: 24, fontVariant: ["tabular-nums"] },
  qrBox: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  qr: { width: 160, height: 160 },
  qrMissing: { fontSize: 14, color: colors.ink2, marginBottom: 12 },
  code: { fontSize: 15, fontWeight: "500", letterSpacing: 1.6, color: colors.ink, marginTop: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "500", color: colors.ink, marginBottom: 12, marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowText: { fontSize: 15, color: colors.ink },
  seatBadge: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.woodDark,
    borderWidth: 1,
    borderColor: colors.wood,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontVariant: ["tabular-nums"],
  },
  stop: { fontSize: 14, color: colors.ink1, marginTop: 8 },
  rating: { marginTop: 24 },
  stars: { flexDirection: "row", gap: 4, marginBottom: 16 },
  star: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  starText: { fontSize: 32, color: colors.stone },
  starActive: { color: colors.woodDark },
  ratingDone: { fontSize: 15, color: colors.ink1, marginTop: 24 },
});
