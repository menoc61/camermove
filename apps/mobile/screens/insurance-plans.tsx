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
import { fetchInsurancePolicies, type InsurancePolicy, type CoverageType, COVERAGE_LABELS, COVERAGE_PRICES } from "@/lib/api/insurance";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

const COVERAGE_TYPES: CoverageType[] = ["basic", "standard", "premium", "family"];

export function InsurancePlansScreen() {
  const router = useRouter();
  const [coverageType, setCoverageType] = useState<CoverageType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      coverageType: coverageType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      q: q.trim() === "" ? undefined : q.trim(),
      page,
      perPage: 20,
    }),
    [coverageType, dateFrom, dateTo, q, page],
  );

  const list = useQuery({
    queryKey: ["insurance-plans", params],
    queryFn: () => fetchInsurancePolicies("", params),
    placeholderData: (prev) => prev,
  });

  function resetFilters() {
    setCoverageType("");
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
          <Text style={styles.eyebrow}>Assurance Voyage</Text>
          <Text style={styles.title}>Protégez votre voyage</Text>
          <Text style={styles.subtitle}>
            Choisissez la couverture adaptée à vos besoins.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <View style={styles.filters}>
          <Text style={styles.filterLabel}>Type de couverture</Text>
          <View style={styles.chipRow}>
            {COVERAGE_TYPES.map((type) => (
              <AnimatedPressFeedback
                key={type}
                onPress={() => { setCoverageType(coverageType === type ? "" : type); setPage(1); }}
                style={[styles.chip, coverageType === type && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Couverture : ${COVERAGE_LABELS[type]}`}
                accessibilityState={{ selected: coverageType === type }}
              >
                <Text style={[styles.chipText, coverageType === type && styles.chipTextActive]}>
                  {COVERAGE_LABELS[type]}
                </Text>
              </AnimatedPressFeedback>
            ))}
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Field
                label="Date début"
                value={dateFrom}
                onChangeText={(v) => { setDateFrom(v); setPage(1); }}
                placeholder="AAAA-MM-JJ"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCol}>
              <Field
                label="Date fin"
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
            placeholder="Destination, assureur..."
            autoCapitalize="words"
          />
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(2)}>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            <Text style={styles.summaryBold}>{total}</Text> offre{total > 1 ? "s" : ""}
            {coverageType ? ` · ${COVERAGE_LABELS[coverageType as CoverageType]}` : ""}
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
            message="Impossible de charger les offres."
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
              message="Aucune offre ne correspond à ces critères."
              actionLabel="Réinitialiser les filtres"
              onAction={resetFilters}
            />
          }
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 50}>
              <InsurancePlanCard plan={item} onPress={() => router.push(`/insurance/${encodeURIComponent(item.id)}` as never)} />
            </Reveal>
          )}
        />
      )}
    </View>
  );
}

function InsurancePlanCard({ plan, onPress }: { plan: InsurancePolicy; onPress: () => void }) {
  const label = COVERAGE_LABELS[plan.coverageType] ?? plan.coverageType;
  const basePrice = COVERAGE_PRICES[plan.coverageType] ?? plan.premium;

  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${plan.providerName} ${label}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Text style={styles.cardEyebrow}>{plan.providerName}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={styles.badge}>{plan.currency}</Text>
      </View>

      <Text style={styles.cardMeta}>
        {plan.destination} · {plan.travelers} voyageur{plan.travelers > 1 ? "s" : ""}
      </Text>
      <Text style={styles.cardDate}>
        {new Date(plan.startDate).toLocaleDateString("fr-FR")} – {new Date(plan.endDate).toLocaleDateString("fr-FR")}
      </Text>

      <View style={styles.cardFoot}>
        <Text style={styles.cardPrice}>
          {formatXAF(plan.premium)}
        </Text>
        <Text style={styles.cardBasePrice}>
          Base : {formatXAF(basePrice)}
        </Text>
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
  filterLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  dateRow: { flexDirection: "row", gap: 8 },
  dateCol: { flex: 1 },
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
  badge: { fontSize: 12, color: colors.ink2 },
  cardMeta: { fontSize: 13, color: colors.ink1, marginBottom: 4 },
  cardDate: { fontSize: 12, color: colors.ink2, fontVariant: ["tabular-nums"] },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  cardPrice: { fontSize: 18, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  cardBasePrice: { fontSize: 11, color: colors.ink2 },
});