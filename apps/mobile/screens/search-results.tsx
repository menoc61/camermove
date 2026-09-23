import { BottomSheet, RNHostView } from "@expo/ui";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { TripCard } from "@/components/search/trip-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchSearch, type SearchParams } from "@/lib/api/search";
import { useSearchStore } from "@/lib/stores/search";

type SortKey = NonNullable<SearchParams["sortBy"]>;

const SORTS: SortKey[] = ["price_asc", "price_desc", "departure_asc"];
const SORT_LABELS = ["Prix croissant", "Prix décroissant", "Départ"];

const VEHICLE_OPTIONS = ["Tous", "VIP", "Standard", "Express"] as const;

function sortIndex(sort: SortKey): number {
  return Math.max(0, SORTS.indexOf(sort));
}

export function SearchResultsScreen() {
  const router = useRouter();
  const { origin, destination, date, pax } = useSearchStore();
  const [sortBy, setSortBy] = useState<SortKey>("price_asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [vehicle, setVehicle] = useState<(typeof VEHICLE_OPTIONS)[number]>("Tous");

  const applied = useMemo(() => {
    const min = minPriceText.trim() === "" ? undefined : Number(minPriceText.replace(/\s/g, ""));
    const max = maxPriceText.trim() === "" ? undefined : Number(maxPriceText.replace(/\s/g, ""));
    return {
      minPrice: typeof min === "number" && Number.isFinite(min) ? min : undefined,
      maxPrice: typeof max === "number" && Number.isFinite(max) ? max : undefined,
      vehicleType: vehicle === "Tous" ? undefined : vehicle,
    };
  }, [minPriceText, maxPriceText, vehicle]);

  const activeFilterCount =
    (applied.minPrice !== undefined ? 1 : 0) +
    (applied.maxPrice !== undefined ? 1 : 0) +
    (applied.vehicleType !== undefined ? 1 : 0);

  const query = useQuery({
    queryKey: ["search", origin, destination, date, pax, sortBy, applied.minPrice, applied.maxPrice, applied.vehicleType],
    queryFn: () =>
      fetchSearch({
        origin,
        destination,
        date,
        pax,
        sortBy,
        minPrice: applied.minPrice,
        maxPrice: applied.maxPrice,
        vehicleType: applied.vehicleType,
      }),
  });

  function resetFilters() {
    setMinPriceText("");
    setMaxPriceText("");
    setVehicle("Tous");
  }

  if (query.isPending) {
    return <LoadingState label="Recherche des trajets…" />;
  }

  if (query.isError) {
    return (
      <ErrorState message="Impossible de charger les résultats." onRetry={() => void query.refetch()} />
    );
  }

  const items = query.data.items;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Recherche</Text>
        <Text style={styles.title}>
          {origin} → {destination}
        </Text>
        <Text style={styles.meta}>
          {date} · {pax} passager{pax > 1 ? "s" : ""}
        </Text>
      </View>

      <View style={styles.controls}>
        <SegmentedControl
          values={[...SORT_LABELS]}
          selectedIndex={sortIndex(sortBy)}
          onValueChange={(value) => {
            const i = SORT_LABELS.indexOf(value);
            if (i >= 0) setSortBy(SORTS[i]);
          }}
          onChange={(event) => {
            const i = event.nativeEvent.selectedSegmentIndex;
            if (i >= 0 && i < SORTS.length) setSortBy(SORTS[i]);
          }}
        />
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={styles.filterButton}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les filtres"
        >
          <Text style={styles.filterLabel}>
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            message="Aucun résultat pour cette recherche."
            actionLabel="Modifier la recherche"
            onAction={() => router.push("/(tabs)")}
          />
        }
        renderItem={({ item, index }) => (
          <TripCard trip={item} highlight={index === 0 && sortBy === "price_asc" ? "best_price" : null} />
        )}
      />

      <BottomSheet
        isPresented={filtersOpen}
        onDismiss={() => setFiltersOpen(false)}
        snapPoints={["half", "full"]}
      >
        <RNHostView matchContents>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Filtres</Text>
            <Field
              label="Prix min (FCFA)"
              value={minPriceText}
              onChangeText={setMinPriceText}
              keyboardType="numeric"
              placeholder="ex : 2000"
            />
            <Field
              label="Prix max (FCFA)"
              value={maxPriceText}
              onChangeText={setMaxPriceText}
              keyboardType="numeric"
              placeholder="ex : 8000"
            />
            <Text style={styles.sheetLabel}>Type de véhicule</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setVehicle(option)}
                  style={[styles.vehicleChip, vehicle === option && styles.vehicleChipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrer : ${option}`}
                >
                  <Text style={[styles.vehicleText, vehicle === option && styles.vehicleTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <Button label="Appliquer" onPress={() => setFiltersOpen(false)} />
              <Pressable onPress={resetFilters} accessibilityRole="button" accessibilityLabel="Réinitialiser les filtres">
                <Text style={styles.reset}>Réinitialiser</Text>
              </Pressable>
            </View>
          </View>
        </RNHostView>
      </BottomSheet>
    </View>
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
  title: { fontSize: 24, fontWeight: "500", color: colors.ink },
  meta: { fontSize: 13, color: colors.ink2, marginTop: 4 },
  controls: { paddingHorizontal: 24, paddingVertical: 12, gap: 12 },
  filterButton: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: "center",
  },
  filterLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase", color: colors.ink },
  list: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 4 },
  sheet: { padding: 24, gap: 4, minWidth: 320 },
  sheetTitle: { fontSize: 20, fontWeight: "500", color: colors.ink, marginBottom: 12 },
  sheetLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
    marginTop: 8,
  },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  vehicleChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  vehicleChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  vehicleText: { fontSize: 13, color: colors.ink },
  vehicleTextActive: { color: colors.paper },
  sheetActions: { gap: 12, marginTop: 8 },
  reset: { fontSize: 14, color: colors.woodDark, textAlign: "center", paddingVertical: 12 },
});
