import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonText } from "@/components/ui/skeleton-presets";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { trackParcel, type TrackParcelResponse } from "@/lib/api/parcels";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

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

const statusColors: Record<string, string> = {
  created: "#6B6B6B",
  collected: "#6F5638",
  in_transit: "#6F5638",
  delivered: "#2E7D32",
  cancelled: "#B3261E",
};

export function ParcelTrackScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const initialRef = typeof params.ref === "string" ? params.ref : "";
  const [input, setInput] = useState(initialRef);
  const [submitted, setSubmitted] = useState<string | null>(initialRef ? initialRef : null);

  const trackQuery = useQuery({
    queryKey: ["parcel-track", submitted],
    queryFn: () => trackParcel(submitted as string),
    enabled: submitted !== null,
    retry: false,
  });

  function submit() {
    const ref = input.trim();
    if (!ref) return;
    setSubmitted(ref);
  }

  const error = trackQuery.error;
  const errorMessage =
    error instanceof Error ? error.message : "Échec du suivi.";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Reveal>
        <Text style={styles.eyebrow}>CamerMove</Text>
        <Text style={styles.title}>Suivre un colis</Text>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <Field
          label="Numéro de suivi"
          value={input}
          onChangeText={setInput}
          placeholder="Ex : CM-PARCEL-123"
          autoCapitalize="characters"
        />
        {trackQuery.isPending ? (
          <Spinner label="Suivi en cours…" />
        ) : (
          <ActionButton label="Suivre" onPress={submit} />
        )}
      </Reveal>

      <Reveal delay={motion.stagger(2)}>
        <View style={styles.result}>
          {submitted === null ? (
            <EmptyState message="Saisissez un numéro de suivi pour suivre un colis." />
          ) : trackQuery.isPending ? (
            <SkeletonText lines={5} />
          ) : trackQuery.isError ? (
            <ErrorState
              message={errorMessage}
              onRetry={() => void trackQuery.refetch()}
            />
          ) : trackQuery.data ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.trackingNumber}>
                  {trackQuery.data.trackingNumber}
                </Text>
                <Text
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[trackQuery.data.status] || colors.ink2 },
                  ]}
                >
                  {trackQuery.data.status}
                </Text>
              </View>
              <Text style={styles.route}>
                {trackQuery.data.senderCity} → {trackQuery.data.recipientCity}
              </Text>
              <Text style={styles.meta}>
                {trackQuery.data.parcelType} ·{" "}
                {trackQuery.data.weightKg
                  ? `${trackQuery.data.weightKg} kg`
                  : "Poids non spécifié"}
              </Text>
              <Text style={styles.meta}>
                Coût : {formatXAF(trackQuery.data.shippingCost)}
              </Text>

              <Text style={styles.sectionTitle}>Historique</Text>
              {trackQuery.data.statusHistory.length === 0 ? (
                <Text style={styles.muted}>Aucune mise à jour disponible.</Text>
              ) : (
                <View style={styles.timeline}>
                  {trackQuery.data.statusHistory.map((h, i) => (
                    <View
                      key={`${h.status}-${h.createdAt}-${i}`}
                      style={styles.timelineItem}
                    >
                      <View style={styles.timelineConnector}>
                        {i === 0 ? (
                          <View
                            style={[
                              styles.timelineDot,
                              { backgroundColor: statusColors[h.status] || colors.ink },
                            ]}
                          />
                        ) : (
                          <View style={[styles.timelineDot, { backgroundColor: colors.line }]} />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text
                          style={[
                            styles.timelineStatus,
                            { color: statusColors[h.status] || colors.ink },
                          ]}
                        >
                          {h.status}
                        </Text>
                        <Text style={styles.timelineLocation}>{h.location}</Text>
                        {h.note ? (
                          <Text style={styles.timelineNote}>{h.note}</Text>
                        ) : null}
                        <Text style={styles.timelineTime}>
                          {formatDateTime(h.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </Reveal>

      {submitted && !trackQuery.isPending && !trackQuery.isError && !trackQuery.data ? (
        <AnimatedPressFeedback style={styles.retryHint}>
          <Text style={styles.muted}>Aucune information à afficher.</Text>
        </AnimatedPressFeedback>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48, gap: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24, letterSpacing: -1 },
  result: { marginTop: 16 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  route: { fontSize: 20, fontWeight: "500", color: colors.ink, marginTop: 8 },
  meta: { fontSize: 13, color: colors.ink1, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  muted: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  timeline: { gap: 16 },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineConnector: { flexDirection: "column", alignItems: "center", justifyContent: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 0 },
  timelineContent: { flex: 1, gap: 2 },
  timelineStatus: { fontSize: 13, fontWeight: "500" },
  timelineLocation: { fontSize: 15, fontWeight: "500", color: colors.ink },
  timelineNote: { fontSize: 13, color: colors.ink1 },
  timelineTime: { fontSize: 11, color: colors.ink2 },
  retryHint: { marginTop: 16, alignItems: "center" },
});
