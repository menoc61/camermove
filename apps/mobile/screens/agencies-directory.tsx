import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonList } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import {
  fetchAgenciesList,
  type AgenciesQuery,
  type AgencyCategory,
  type AgencyListItem,
} from "@/lib/api/agencies";
import {
  AMENITY_LABEL,
  CATEGORY_LABEL,
  CITIES,
} from "@/lib/data/agency-meta";
import { colors } from "@/constants/theme";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

type FilterChip = "all" | AgencyCategory;

const CATEGORIES: readonly AgencyCategory[] = [
  "interurban",
  "urban",
  "mixed",
  "parcel",
  "rental",
  "vip",
];

function categoryLabel(key: AgencyCategory): string {
  return CATEGORY_LABEL[key as keyof typeof CATEGORY_LABEL] ?? key;
}

export function AgenciesDirectoryScreen() {
  const router = useRouter();
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<FilterChip>("all");
  const [query, setQuery] = useState("");

  const filters: AgenciesQuery = useMemo(
    () => ({
      city: city ?? undefined,
      category: category === "all" ? undefined : category,
      q: query.trim() === "" ? undefined : query.trim(),
    }),
    [city, category, query],
  );

  const list = useQuery({
    queryKey: ["agencies", filters],
    queryFn: () => fetchAgenciesList(filters),
    placeholderData: (prev) => prev,
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const hasFilters = city !== null || category !== "all" || query.trim() !== "";

  function reset() {
    setCity(null);
    setCategory("all");
    setQuery("");
  }

  function openAgency(agency: AgencyListItem) {
    router.push(`/agencies/${encodeURIComponent(agency.id)}` as never);
  }

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Annuaire · Transporteurs partenaires</Text>
          <Text style={styles.title}>Nos agences de transport</Text>
          <Text style={styles.subtitle}>
            Comparez les transporteurs interurbains et intra-urbains opérant au Cameroun.
            Notes vérifiées, équipements à bord, fréquence des départs.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <View style={styles.filterBlock}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher une agence…"
            placeholderTextColor={colors.ink2}
            style={styles.search}
            accessibilityLabel="Rechercher une agence"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Ville</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="Toutes"
              active={city === null}
              onPress={() => setCity(null)}
            />
            {CITIES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={city === c.label}
                onPress={() => setCity(c.label)}
              />
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Catégorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="Toutes"
              active={category === "all"}
              onPress={() => setCategory("all")}
            />
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={categoryLabel(c)}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
        </View>
      </Reveal>

      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          <Text style={styles.summaryBold}>{total}</Text> agence{total > 1 ? "s" : ""}
          {city ? ` à ${city}` : ""}
          {query.trim() ? ` · "${query.trim()}"` : ""}
        </Text>
        {hasFilters ? (
          <AnimatedPressFeedback onPress={reset} accessibilityRole="button">
            <Text style={styles.resetLink}>Réinitialiser</Text>
          </AnimatedPressFeedback>
        ) : null}
      </View>

      {list.isPending ? (
        <View style={styles.listPending}>
          <SkeletonList count={4} />
        </View>
      ) : list.isError ? (
        <ErrorState
          message="Impossible de charger les agences."
          onRetry={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState message="Aucune agence ne correspond à ces critères." />
      ) : (
        <View style={styles.listWrap}>
          <FlashList
            data={items as AgencyListItem[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Reveal delay={motion.stagger(Math.min(index, 4))}>
                <AgencyCard agency={item} onPress={() => openAgency(item)} />
              </Reveal>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </AnimatedPressFeedback>
  );
}

function AgencyCard({
  agency,
  onPress,
}: {
  agency: AgencyListItem;
  onPress: () => void;
}) {
  const brand = agency.brand.primary;
  const lowestPrice = agency.routes.length
    ? Math.min(...agency.routes.map((r) => r.priceFromXaf))
    : null;
  const previewRoutes = agency.routes.slice(0, 4);

  return (
    <AnimatedPressFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${agency.companyName}`}
      style={styles.card}
    >
      <View style={[styles.brandBand, { backgroundColor: brand }]}>
        <View style={styles.brandLeft}>
          <Text style={styles.brandEyebrow}>{categoryLabel(agency.category)}</Text>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {agency.companyName}
          </Text>
        </View>
        <View style={styles.brandRight}>
          <Text style={styles.rating}>
            {agency.ratingAvg != null ? agency.ratingAvg.toFixed(1) : "—"}
          </Text>
          <Text style={styles.ratingCount}>{agency.ratingCount} avis</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.tagline} numberOfLines={2}>
          {agency.tagline}
        </Text>

        <View style={styles.metaRow}>
          <MetaTag label={agency.city ?? "Cameroun"} />
          <MetaTag label={`${agency.fleetCount} bus`} />
          {agency.activeDeparturesToday > 0 ? (
            <MetaTag label={`${agency.activeDeparturesToday} dép. auj.`} highlight />
          ) : null}
        </View>

        <View style={styles.routeRow}>
          {previewRoutes.map((r, i) => (
            <View key={`${r.origin}-${r.destination}-${i}`} style={styles.routeTag}>
              <Text style={styles.routeTagLabel}>
                {r.origin} → {r.destination}
              </Text>
            </View>
          ))}
          {agency.routes.length > 4 ? (
            <Text style={styles.routeMore}>+{agency.routes.length - 4}</Text>
          ) : null}
        </View>

        <View style={styles.amenitiesRow}>
          {agency.amenities.slice(0, 5).map((a) => (
            <Text key={a} style={styles.amenityChip} numberOfLines={1}>
              {AMENITY_LABEL[a] ?? a}
            </Text>
          ))}
        </View>

        <View style={styles.cardFoot}>
          <Text style={styles.sinceLabel}>Depuis {agency.yearFounded}</Text>
          {lowestPrice !== null ? (
            <Text style={styles.priceLabel}>
              dès <Text style={styles.priceValue}>{formatXAF(lowestPrice)}</Text>
            </Text>
          ) : null}
        </View>
      </View>
    </AnimatedPressFeedback>
  );
}

function MetaTag({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <View style={[styles.metaTag, highlight && styles.metaTagHighlight]}>
      <Text style={[styles.metaTagLabel, highlight && styles.metaTagLabelHighlight]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "500",
    color: colors.ink,
    letterSpacing: -1.2,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  filterBlock: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  chipRow: { gap: 8, paddingBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    minHeight: 44,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  chipLabelActive: { color: colors.paper },
  summaryRow: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  summary: { fontSize: 13, color: colors.ink2, flex: 1, marginRight: 12 },
  summaryBold: { color: colors.ink, fontWeight: "500" },
  resetLink: { fontSize: 13, color: colors.woodDark, fontWeight: "500" },
  listWrap: { flex: 1 },
  listPending: { paddingHorizontal: 24, paddingTop: 16 },
  list: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  sep: { height: 12 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
  },
  brandBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  brandLeft: { flex: 1, marginRight: 12 },
  brandEyebrow: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  brandTitle: { fontSize: 18, fontWeight: "500", color: "#FFFFFF" },
  brandRight: { alignItems: "flex-end" },
  rating: {
    fontSize: 18,
    fontWeight: "500",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  ratingCount: { fontSize: 11, color: "rgba(255,255,255,0.85)" },
  cardBody: { padding: 16 },
  tagline: { fontSize: 13, color: colors.ink1, lineHeight: 18, marginBottom: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  metaTag: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaTagHighlight: { backgroundColor: colors.ink, borderColor: colors.ink },
  metaTagLabel: { fontSize: 11, color: colors.ink2 },
  metaTagLabelHighlight: { color: colors.paper, fontWeight: "500" },
  routeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  routeTag: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  routeTagLabel: { fontSize: 11, color: colors.ink1, fontVariant: ["tabular-nums"] },
  routeMore: { fontSize: 11, color: colors.ink2, alignSelf: "center" },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  amenityChip: {
    fontSize: 11,
    color: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: 160,
  },
  cardFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  sinceLabel: { fontSize: 11, color: colors.ink2, letterSpacing: 0.5 },
  priceLabel: { fontSize: 12, color: colors.ink2 },
  priceValue: {
    fontSize: 14,
    color: colors.woodDark,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
});
