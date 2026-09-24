import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { colors } from "@/constants/theme";
import { fetchParcel, trackParcel, type Parcel, type TrackParcelResponse } from "@/lib/api/parcels";
import { formatXAF } from "@/lib/format";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ParcelDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : null;

  const parcelQuery = useQuery({
    queryKey: ["parcel", id],
    queryFn: () => fetchParcel(id as string, ""),
    enabled: !!id,
  });

  const trackingQuery = useQuery({
    queryKey: ["parcel-track", id],
    queryFn: () => trackParcel(id as string),
    enabled: !!id,
  });

  if (!id) {
    return (
      <EmptyState
        message="Envoi introuvable."
        actionLabel="Retour aux colis"
        onAction={() => router.push("/parcels")}
      />
    );
  }

  if (parcelQuery.isPending || trackingQuery.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonHero />
          <View style={{ marginTop: 16 }}>
            <SkeletonText lines={4} />
          </View>
        </View>
      </View>
    );
  }

  if (parcelQuery.isError || !parcelQuery.data) {
    return (
      <ErrorState message="Impossible de charger cet envoi." onRetry={() => void parcelQuery.refetch()} />
    );
  }

  const parcel: Parcel = parcelQuery.data;
  const tracking: TrackParcelResponse | null = trackingQuery.data ?? null;
  const history = tracking?.statusHistory ?? parcel.statusHistory ?? [];

  const statusColors: Record<string, string> = {
    created: colors.ink2,
    collected: colors.woodDark,
    in_transit: colors.woodDark,
    delivered: "#2E7D32",
    cancelled: "#B3261E",
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Reveal>
        <View style={[styles.statusCard, { borderLeftColor: statusColors[parcel.status] || colors.ink2 }]}>
          <View style={styles.statusHeader}>
            <Text style={styles.trackingNumber}>{parcel.trackingNumber}</Text>
            <Text style={[styles.statusBadge, { backgroundColor: statusColors[parcel.status] || colors.ink2 }]}>
              {parcel.status}
            </Text>
          </View>
          <Text style={styles.route}>
            {parcel.senderCity} → {parcel.recipientCity}
          </Text>
          <Text style={styles.meta}>
            {parcel.parcelType} · {parcel.weightKg ? `${parcel.weightKg} kg` : "Poids non spécifié"}
          </Text>
        </View>
      </Reveal>

      <Reveal delay={60}>
        <Text style={styles.sectionTitle}>Détails</Text>
        <View style={styles.detailsCard}>
          <Text style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expéditeur :</Text> {parcel.senderName} · {parcel.senderPhone}
          </Text>
          <Text style={styles.detailRow}>
            <Text style={styles.detailLabel}>Destinataire :</Text> {parcel.recipientName} · {parcel.recipientPhone}
          </Text>
          <Text style={styles.detailRow}>
            <Text style={styles.detailLabel}>Coût :</Text> {formatXAF(parcel.shippingCost)}
          </Text>
          {parcel.description ? (
            <Text style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description :</Text> {parcel.description}
            </Text>
          ) : null}
          <Text style={styles.detailRow}>
            <Text style={styles.detailLabel}>Créé le :</Text> {new Date(parcel.createdAt).toLocaleString("fr-FR")}
          </Text>
        </View>
      </Reveal>

      <Reveal delay={120}>
        <Text style={styles.sectionTitle}>Suivi</Text>
        {history.length === 0 ? (
          <Text style={styles.muted}>Aucune mise à jour de suivi disponible.</Text>
        ) : (
          <View style={styles.timeline}>
            {history.map((h, i) => (
              <View key={`${h.status}-${h.createdAt}-${i}`} style={styles.timelineItem}>
                <View style={styles.timelineConnector}>
                  {i === 0 ? (
                    <View style={[styles.timelineDot, { backgroundColor: statusColors[h.status] || colors.ink }]} />
                  ) : (
                    <View style={[styles.timelineDot, { backgroundColor: colors.line }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineStatus, { color: statusColors[h.status] || colors.ink }]}>
                    {h.status}
                  </Text>
                  <Text style={styles.timelineLocation}>{h.location}</Text>
                  {h.note ? <Text style={styles.timelineNote}>{h.note}</Text> : null}
                  <Text style={styles.timelineTime}>{formatDateTime(h.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  statusCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  trackingNumber: { fontSize: 18, fontWeight: "500", color: colors.ink },
  statusBadge: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  route: { fontSize: 20, fontWeight: "500", color: colors.ink, marginTop: 4 },
  meta: { fontSize: 13, color: colors.ink1, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  detailsCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  detailRow: { fontSize: 14, color: colors.ink1 },
  detailLabel: { fontWeight: "500", color: colors.ink },
  muted: { fontSize: 14, color: colors.ink2 },
  timeline: { gap: 16 },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineConnector: { flexDirection: "column", alignItems: "center", justifyContent: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 0 },
  timelineContent: { flex: 1, gap: 2 },
  timelineStatus: { fontSize: 13, fontWeight: "500" },
  timelineLocation: { fontSize: 15, fontWeight: "500", color: colors.ink },
  timelineNote: { fontSize: 13, color: colors.ink1 },
  timelineTime: { fontSize: 11, color: colors.ink2 },
});