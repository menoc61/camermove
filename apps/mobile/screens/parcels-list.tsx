import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonCard } from "@/components/ui/skeleton-presets";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchParcels, type Parcel, type ParcelSearchQuery } from "@/lib/api/parcels";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

const PARCEL_TYPES = [
  { value: "", label: "Tous" },
  { value: "document", label: "Document" },
  { value: "package", label: "Colis" },
  { value: "fragile", label: "Fragile" },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ParcelsListScreen() {
  const router = useRouter();
  const [senderCity, setSenderCity] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [parcelType, setParcelType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params: ParcelSearchQuery = useMemo(
    () => ({
      senderCity: senderCity.trim() === "" ? undefined : senderCity.trim(),
      recipientCity: recipientCity.trim() === "" ? undefined : recipientCity.trim(),
      parcelType: parcelType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      q: q.trim() === "" ? undefined : q.trim(),
      page,
      perPage: 20,
    }),
    [senderCity, recipientCity, parcelType, dateFrom, dateTo, q, page],
  );

  const list = useQuery({
    queryKey: ["parcels", params],
    queryFn: () => fetchParcels("", params),
    placeholderData: (prev) => prev,
  });

  function resetFilters() {
    setSenderCity("");
    setRecipientCity("");
    setParcelType("");
    setDateFrom("");
    setDateTo("");
    setQ("");
    setPage(1);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Colis & Livraison</Text>
          <Text style={styles.title}>Envoyez & suivez vos colis</Text>
          <Text style={styles.subtitle}>
            Comparez les tarifs, créez vos expéditions et suivez en temps réel.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <View style={styles.filters}>
          <Field
            label="Ville d'envoi"
            value={senderCity}
            onChangeText={(v) => { setSenderCity(v); setPage(1); }}
            placeholder="ex : Yaoundé"
            autoCapitalize="words"
          />
          <Field
            label="Ville de destination"
            value={recipientCity}
            onChangeText={(v) => { setRecipientCity(v); setPage(1); }}
            placeholder="ex : Douala"
            autoCapitalize="words"
          />
          <Field
            label="Type de colis"
            value={parcelType}
            onChangeText={(v) => { setParcelType(v); setPage(1); }}
            placeholder="Tous"
            autoCapitalize="words"
          />
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Field
                label="Du"
                value={dateFrom}
                onChangeText={(v) => { setDateFrom(v); setPage(1); }}
                placeholder="AAAA-MM-JJ"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCol}>
              <Field
                label="Au"
                value={dateTo}
                onChangeText={(v) => { setDateTo(v); setPage(1); }}
                placeholder="AAAA-MM-JJ"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <Field
            label="Recherche"
            value={q}
            onChangeText={(v) => { setQ(v); setPage(1); }}
            placeholder="N° suivi, expéditeur..."
            autoCapitalize="words"
          />
        </View>
      </Reveal>

      <Reveal delay={120}>
        <View style={styles.ctaRow}>
          <ActionButton
            label="Créer un envoi"
            onPress={() => router.push("/parcels/create" as never)}
            successLabel="Ouverture…"
          />
        </View>
      </Reveal>

      <Reveal delay={120}>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            <Text style={styles.summaryBold}>{total}</Text> envoi{total > 1 ? "s" : ""}
            {senderCity ? ` depuis ${senderCity}` : ""}
            {recipientCity ? ` vers ${recipientCity}` : ""}
          </Text>
          <AnimatedPressFeedback
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Réinitialiser les filtres"
            hitSlop={8}
            style={styles.resetPressable}
          >
            <Text style={styles.resetLink}>Réinitialiser</Text>
          </AnimatedPressFeedback>
        </View>
      </Reveal>

      {list.isPending ? (
        <View style={styles.listWrap}>
          <SkeletonCard />
          <View style={{ height: 12 }} />
          <SkeletonCard />
          <View style={{ height: 12 }} />
          <SkeletonCard />
        </View>
      ) : list.isError ? (
        <View style={styles.listWrap}>
          <ErrorState
            message="Impossible de charger les envois."
            onRetry={() => void list.refetch()}
          />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listWrap}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              message="Aucun envoi ne correspond à ces critères."
              actionLabel="Réinitialiser les filtres"
              onAction={resetFilters}
            />
          }
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 50}>
              <ParcelCard parcel={item} onPress={() => router.push(`/parcels/${encodeURIComponent(item.id)}` as never)} />
            </Reveal>
          )}
        />
      )}
    </View>
  );
}

function ParcelCard({ parcel, onPress }: { parcel: Parcel; onPress: () => void }) {
  const statusColors: Record<string, string> = {
    created: colors.ink2,
    collected: colors.woodDark,
    in_transit: colors.woodDark,
    delivered: "#2E7D32",
    cancelled: "#B3261E",
  };

  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Suivre ${parcel.trackingNumber} ${parcel.senderCity} → ${parcel.recipientCity}`}
    >
      <View style={styles.cardHead}>
        <Text style={styles.cardEyebrow}>{parcel.trackingNumber}</Text>
        <Text style={[styles.statusBadge, { backgroundColor: statusColors[parcel.status] || colors.ink2 }]}>
          {parcel.status}
        </Text>
      </View>
      <Text style={styles.cardRoute}>
        {parcel.senderCity} → {parcel.recipientCity}
      </Text>
      <Text style={styles.cardMeta}>
        {parcel.parcelType} · {parcel.weightKg ? `${parcel.weightKg} kg` : "Poids non spécifié"}
      </Text>
      <View style={styles.cardFoot}>
        <Text style={styles.cardPrice}>{formatXAF(parcel.shippingCost)}</Text>
        <Text style={styles.cardDate}>{new Date(parcel.createdAt).toLocaleDateString("fr-FR")}</Text>
      </View>
    </AnimatedPressFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 13, color: colors.ink2, lineHeight: 19 },
  filters: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 8 },
  dateRow: { flexDirection: "row", gap: 8 },
  dateCol: { flex: 1 },
  ctaRow: { paddingHorizontal: 24, marginTop: 8 },
  summaryRow: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  summary: { fontSize: 13, color: colors.ink2, flex: 1, marginRight: 12 },
  summaryBold: { color: colors.ink, fontWeight: "500" },
  resetPressable: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 32, justifyContent: "center" },
  resetLink: { fontSize: 12, color: colors.woodDark, fontWeight: "500", letterSpacing: 1.4 },
  listWrap: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 12,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardRoute: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  cardMeta: { fontSize: 13, color: colors.ink1, marginBottom: 8 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  cardPrice: { fontSize: 16, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  cardDate: { fontSize: 12, color: colors.ink2 },
});