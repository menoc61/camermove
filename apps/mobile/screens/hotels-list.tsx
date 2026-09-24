import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonCard } from "@/components/ui/skeleton-presets";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchHotels, type HotelItem, type HotelsParams } from "@/lib/api/hotels";
import { formatXAF } from "@/lib/format";

function isValidDate(value: string): boolean {
  if (!value) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parsePrice(value: string): number | undefined {
  const cleaned = value.replace(/\s/g, "").trim();
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function HotelsListScreen() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(tomorrowISO());
  const [guests, setGuests] = useState(2);
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params: HotelsParams = {
    city: city.trim() === "" ? undefined : city.trim(),
    checkIn: isValidDate(checkIn) ? checkIn : undefined,
    checkOut: isValidDate(checkOut) ? checkOut : undefined,
    guests,
    minPrice: parsePrice(minPriceText),
    maxPrice: parsePrice(maxPriceText),
    q: q.trim() === "" ? undefined : q.trim(),
    page,
    perPage: 20,
  };

  const list = useQuery({
    queryKey: ["hotels", params],
    queryFn: () => fetchHotels(params),
    placeholderData: (prev) => prev,
  });

  function resetFilters() {
    setCity("");
    setMinPriceText("");
    setMaxPriceText("");
    setQ("");
    setPage(1);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Hébergement</Text>
          <Text style={styles.title}>Hôtels & apparts</Text>
          <Text style={styles.subtitle}>
            Comparez les hébergements partenaires et réservez en quelques secondes.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={60}>
        <View style={styles.filters}>
          <Field
            label="Ville"
            value={city}
            onChangeText={setCity}
            placeholder="ex : Douala"
            autoCapitalize="words"
          />
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Field
                label="Arrivée"
                value={checkIn}
                onChangeText={setCheckIn}
                placeholder="AAAA-MM-JJ"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCol}>
              <Field
                label="Départ"
                value={checkOut}
                onChangeText={setCheckOut}
                placeholder="AAAA-MM-JJ"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Field
                label="Pers."
                value={String(guests)}
                onChangeText={(v) => setGuests(Math.min(10, Math.max(1, Number(v.replace(/\D/g, "")) || 1)))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.col}>
              <Field
                label="Min FCFA"
                value={minPriceText}
                onChangeText={setMinPriceText}
                keyboardType="numeric"
                placeholder="ex : 5000"
              />
            </View>
            <View style={styles.col}>
              <Field
                label="Max FCFA"
                value={maxPriceText}
                onChangeText={setMaxPriceText}
                keyboardType="numeric"
                placeholder="ex : 50000"
              />
            </View>
          </View>
          <Field
            label="Recherche"
            value={q}
            onChangeText={setQ}
            placeholder="Nom de l'hôtel"
            autoCapitalize="words"
          />
        </View>
      </Reveal>

      <Reveal delay={120}>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            <Text style={styles.summaryBold}>{total}</Text> hôtel{total > 1 ? "s" : ""}
            {city ? ` à ${city}` : ""}
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
            message="Impossible de charger les hôtels."
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
              message="Aucun hôtel ne correspond à ces critères."
              actionLabel="Voir tout"
              onAction={resetFilters}
            />
          }
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 50}>
              <HotelCard
                hotel={item}
                onPress={() => router.push(`/hotels/${encodeURIComponent(item.id)}` as never)}
              />
            </Reveal>
          )}
        />
      )}
    </View>
  );
}

function HotelCard({ hotel, onPress }: { hotel: HotelItem; onPress: () => void }) {
  const lowestPrice = hotel.rooms.length
    ? Math.min(...hotel.rooms.map((r) => r.pricePerNight))
    : null;
  const stars = hotel.starRating ? "★".repeat(hotel.starRating) : "";

  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${hotel.name} à ${hotel.city}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Text style={styles.cardEyebrow}>
            {hotel.city}
            {hotel.region ? ` · ${hotel.region}` : ""}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {hotel.name}
          </Text>
        </View>
        {stars ? <Text style={styles.stars}>{stars}</Text> : null}
      </View>

      {hotel.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {hotel.description}
        </Text>
      ) : null}

      <View style={styles.cardFoot}>
        <Text style={styles.cardMeta}>
          {hotel.rooms.length} chambre{hotel.rooms.length > 1 ? "s" : ""} · {hotel.amenities.length} services
        </Text>
        {lowestPrice !== null ? (
          <Text style={styles.cardPrice}>
            dès <Text style={styles.cardPriceValue}>{formatXAF(lowestPrice)}</Text>
          </Text>
        ) : null}
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
  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
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
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardHeadLeft: { flex: 1, marginRight: 12 },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: "500", color: colors.ink },
  stars: { fontSize: 14, color: colors.woodDark, letterSpacing: 1 },
  cardDesc: { fontSize: 13, color: colors.ink1, lineHeight: 18, marginBottom: 8 },
  cardFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  cardMeta: { fontSize: 11, color: colors.ink2, letterSpacing: 0.5 },
  cardPrice: { fontSize: 12, color: colors.ink2 },
  cardPriceValue: { fontSize: 14, color: colors.woodDark, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
