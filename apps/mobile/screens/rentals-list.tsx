import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonCard, SkeletonList, SkeletonTile } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchRentals, type RentalsParams, type RentalVehicle } from "@/lib/api/rentals";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

const CATEGORIES = [
  { value: "", label: "Toutes" },
  { value: "sedan", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "minibus", label: "Minibus" },
  { value: "van", label: "Van" },
];

const DRIVER_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "true", label: "Avec chauffeur" },
  { value: "false", label: "Sans chauffeur" },
];

function toNumberOrUndefined(s: string): number | undefined {
  const trimmed = s.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function RentalsListScreen() {
  const router = useRouter();
  const [pickupCity, setPickupCity] = useState("");
  const [category, setCategory] = useState("");
  const [hasDriver, setHasDriver] = useState<"all" | "true" | "false">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params: RentalsParams = useMemo(
    () => ({
      pickupCity: pickupCity.trim() === "" ? undefined : pickupCity.trim(),
      category: category === "" ? undefined : category,
      hasDriver: hasDriver === "all" ? undefined : hasDriver === "true",
      q: q.trim() === "" ? undefined : q.trim(),
      minPrice: toNumberOrUndefined(minPrice),
      maxPrice: toNumberOrUndefined(maxPrice),
      page,
      perPage: 12,
    }),
    [pickupCity, category, hasDriver, minPrice, maxPrice, q, page],
  );

  const query = useQuery({
    queryKey: ["rentals", params],
    queryFn: () => fetchRentals(params),
  });

  function openVehicle(vehicle: RentalVehicle) {
    router.push(`/rentals/${vehicle.id}` as never);
  }

  if (query.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <SkeletonTile />
        </View>
        <View style={styles.listPending}>
          <SkeletonList count={4} />
        </View>
      </View>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Impossible de charger les véhicules."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Location véhicules</Text>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Louez près de chez vous</Text>
            {data ? <Text style={styles.count}>{data.total} véhicules</Text> : null}
          </View>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Field
            label="Ville retrait"
            value={pickupCity}
            onChangeText={(v) => {
              setPickupCity(v);
              setPage(1);
            }}
            placeholder="Douala"
            autoCapitalize="words"
            style={styles.filterField}
          />
          <Field
            label="Prix min (FCFA)"
            value={minPrice}
            onChangeText={(v) => {
              setMinPrice(v);
              setPage(1);
            }}
            keyboardType="numeric"
            placeholder="0"
            style={styles.filterField}
          />
          <Field
            label="Prix max (FCFA)"
            value={maxPrice}
            onChangeText={(v) => {
              setMaxPrice(v);
              setPage(1);
            }}
            keyboardType="numeric"
            placeholder="0"
            style={styles.filterField}
          />
          <Field
            label="Recherche"
            value={q}
            onChangeText={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Marque, modèle"
            autoCapitalize="words"
            style={styles.filterField}
          />
        </ScrollView>
      </Reveal>

      <Reveal delay={motion.stagger(2)}>
        <View style={styles.chipRow}>
          <Text style={styles.chipLabel}>Catégorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((opt) => {
              const active = category === opt.value;
              return (
                <AnimatedPressFeedback
                  key={opt.value || "all"}
                  onPress={() => {
                    setCategory(opt.value);
                    setPage(1);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Catégorie : ${opt.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </AnimatedPressFeedback>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.chipRow}>
          <Text style={styles.chipLabel}>Chauffeur</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DRIVER_OPTIONS.map((opt) => {
              const active = hasDriver === opt.value;
              return (
                <AnimatedPressFeedback
                  key={opt.value}
                  onPress={() => {
                    setHasDriver(opt.value as "all" | "true" | "false");
                    setPage(1);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Chauffeur : ${opt.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </AnimatedPressFeedback>
              );
            })}
          </ScrollView>
        </View>
      </Reveal>

      <View style={styles.listWrap}>
        {items.length === 0 ? (
          <EmptyState
            message="Aucun véhicule disponible — essayez d'autres filtres."
            actionLabel="Réinitialiser les filtres"
            onAction={() => {
              setPickupCity("");
              setCategory("");
              setHasDriver("all");
              setMinPrice("");
              setMaxPrice("");
              setQ("");
              setPage(1);
            }}
          />
        ) : (
          <FlashList
            data={items as RentalVehicle[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <AnimatedPressFeedback
                onPress={() => openVehicle(item)}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`Voir ${item.make} ${item.model}`}
              >
                <View style={styles.photoWrap}>
                  {item.photos && item.photos.length > 0 ? (
                    <Image
                      source={{ uri: item.photos[0] }}
                      style={styles.photo}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        {item.make.charAt(0)}
                      </Text>
                    </View>
                  )}
                  {item.hasDriver ? (
                    <View style={styles.driverBadge}>
                      <Text style={styles.driverBadgeText}>Avec chauffeur</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {item.make} {item.model}
                    {item.year ? ` · ${item.year}` : ""}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.category} · {item.capacity} places · {item.pickupCity}
                    {item.transmission ? ` · ${item.transmission}` : ""}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {formatXAF(item.pricePerUnit)} / {item.durationUnit}
                  </Text>
                </View>
              </AnimatedPressFeedback>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>

      {data && totalPages > 1 ? (
        <Reveal delay={motion.stagger(3)}>
          <View style={styles.pager}>
            <Text style={styles.pagerLabel}>
              Page {page} / {totalPages}
            </Text>
            <View style={styles.pagerButtons}>
              <AnimatedPressFeedback
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={[styles.pagerButton, page <= 1 && styles.pagerButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Page précédente"
                accessibilityState={{ disabled: page <= 1 }}
              >
                <Text style={[styles.pagerButtonText, page <= 1 && styles.pagerButtonTextDisabled]}>
                  ←
                </Text>
              </AnimatedPressFeedback>
              <AnimatedPressFeedback
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={[styles.pagerButton, page >= totalPages && styles.pagerButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Page suivante"
                accessibilityState={{ disabled: page >= totalPages }}
              >
                <Text style={[styles.pagerButtonText, page >= totalPages && styles.pagerButtonTextDisabled]}>
                  →
                </Text>
              </AnimatedPressFeedback>
            </View>
          </View>
        </Reveal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "500", color: colors.ink, letterSpacing: -0.6 },
  count: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: colors.ink2 },
  filterRow: { gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  filterField: { minWidth: 160, marginBottom: 0 },
  chipRow: { paddingHorizontal: 24, paddingVertical: 8, gap: 8 },
  chipLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.paper },
  listWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  listPending: { paddingHorizontal: 24 },
  list: { paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    overflow: "hidden",
  },
  photoWrap: { height: 160, backgroundColor: colors.surface2, position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
  },
  photoPlaceholderText: { fontSize: 36, fontWeight: "500", color: colors.ink2 },
  driverBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  driverBadgeText: { fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: colors.paper },
  cardBody: { padding: 16, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: "500", color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.ink2 },
  cardPrice: { fontSize: 16, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  pagerLabel: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  pagerButtons: { flexDirection: "row", gap: 8 },
  pagerButton: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
  },
  pagerButtonDisabled: { opacity: 0.4 },
  pagerButtonText: { fontSize: 18, color: colors.ink },
  pagerButtonTextDisabled: { color: colors.ink2 },
});
