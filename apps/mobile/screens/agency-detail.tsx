import { useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  Linking as RNLinking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { fetchAgency } from "@/lib/api/agencies";
import { useSearchStore } from "@/lib/stores/search";
import { AMENITY_LABEL, CATEGORY_LABEL } from "@/lib/data/agency-meta";
import { colors } from "@/constants/theme";
import { formatXAF } from "@/lib/format";

export function AgencyDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const id = typeof slug === "string" ? slug : null;
  const setSearch = useSearchStore((s) => s.setSearch);

  const query = useQuery({
    queryKey: ["agency", id],
    queryFn: () => fetchAgency(id as string),
    enabled: !!id,
  });

  if (!id) {
    return <EmptyState message="Agence introuvable." />;
  }

  if (query.isPending) {
    return <LoadingState label="Chargement de l'agence…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Impossible de charger cette agence."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) {
    return <EmptyState message="Agence introuvable." />;
  }
  const agency = data;

  const brand = agency.brand.primary;
  const lowestPrice = agency.routes.length
    ? Math.min(...agency.routes.map((r) => r.priceFromXaf))
    : null;

  function searchRoute(origin: string, destination: string) {
    setSearch({ origin, destination });
    router.push("/(tabs)/search");
  }

  function callAgency() {
    if (agency.phone) void RNLinking.openURL(`tel:${agency.phone}`);
  }

  function emailAgency() {
    if (agency.email) void RNLinking.openURL(`mailto:${agency.email}`);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Retour à l'annuaire"
        style={styles.back}
      >
        <Text style={styles.backLabel}>← Annuaire</Text>
      </Pressable>

      {/* Brand hero — solid band, no gradient (design system §1) */}
      <View style={[styles.hero, { backgroundColor: brand }]}>
        <Text style={styles.heroEyebrow}>
          {CATEGORY_LABEL[agency.category as keyof typeof CATEGORY_LABEL] ?? agency.category} · Depuis {agency.yearFounded}
        </Text>
        <Text style={styles.heroTitle}>{agency.companyName}</Text>
        <Text style={styles.heroTagline}>{agency.tagline}</Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaValue}>
              {agency.ratingAvg != null ? agency.ratingAvg.toFixed(1) : "—"}
            </Text>
            <Text style={styles.heroMetaLabel}>
              {agency.ratingCount} avis
            </Text>
          </View>
          {agency.phone ? (
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaValue} numberOfLines={1}>
                {agency.phone}
              </Text>
              <Text style={styles.heroMetaLabel}>Réservations</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heroActionRow}>
          <Pressable
            onPress={callAgency}
            accessibilityRole="button"
            accessibilityLabel="Appeler l'agence"
            style={({ pressed }) => [
              styles.heroAction,
              styles.heroActionGhost,
              pressed && styles.heroActionPressed,
            ]}
          >
            <Text style={styles.heroActionGhostLabel}>Appeler</Text>
          </Pressable>
          <Pressable
            onPress={emailAgency}
            accessibilityRole="button"
            accessibilityLabel="Envoyer un email"
            style={({ pressed }) => [
              styles.heroAction,
              styles.heroActionGhost,
              pressed && styles.heroActionPressed,
            ]}
          >
            <Text style={styles.heroActionGhostLabel}>Email</Text>
          </Pressable>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>01 — À propos</Text>
        <Text style={styles.sectionBody}>{agency.description}</Text>

        <View style={styles.statGrid}>
          <Stat label="Flotte" value={`${agency.fleetCount} bus`} />
          <Stat label="Passagers / jour" value={`${agency.activeDeparturesToday}`} />
          <Stat
            label="Agences"
            value={`${agency.branchCities.length + 1}`}
          />
          <Stat label="Siège" value={agency.city ?? "Cameroun"} />
        </View>
      </View>

      {/* Amenities + service classes */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>02 — Équipements</Text>
        <View style={styles.chipsRow}>
          {agency.amenities.map((am) => (
            <View key={am} style={styles.chip}>
              <Text style={styles.chipLabel}>{AMENITY_LABEL[am] ?? am}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionEyebrow, styles.subEyebrow]}>Classes servies</Text>
        <View style={styles.chipsRow}>
          {agency.serviceClasses.map((sc) => (
            <View key={sc} style={[styles.chip, styles.chipDark]}>
              <Text style={styles.chipLabelDark}>{sc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Routes operated */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionEyebrow}>03 — Trajets opérés</Text>
            <Text style={styles.sectionTitle}>
              {agency.routesDetailed.length} ligne{agency.routesDetailed.length > 1 ? "s" : ""}
            </Text>
          </View>
          {lowestPrice !== null ? (
            <Text style={styles.sinceLabel}>
              dès {formatXAF(lowestPrice)}
            </Text>
          ) : null}
        </View>

        {agency.routesDetailed.length === 0 ? (
          <EmptyState message="Aucun trajet opéré publié pour le moment." />
        ) : (
          <View style={styles.routeGrid}>
            {agency.routesDetailed.map((r, i) => {
              const hours = Math.floor(r.durationMinutes / 60);
              const minutes = r.durationMinutes % 60;
              const duration = `${hours}h${String(minutes).padStart(2, "0")}`;
              return (
                <Pressable
                  key={`${r.origin}-${r.destination}-${i}`}
                  onPress={() => searchRoute(r.origin, r.destination)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechercher ${r.origin} vers ${r.destination}`}
                  style={({ pressed }) => [
                    styles.routeCard,
                    pressed && styles.routeCardPressed,
                    { borderLeftColor: brand },
                  ]}
                >
                  <View style={styles.routeRow}>
                    <View style={styles.routeLeft}>
                      <Text style={styles.routeTitle}>
                        {r.origin} → {r.destination}
                      </Text>
                      <Text style={styles.routeMeta}>
                        {r.classType} · {duration} · {r.dailyDepartures} dép./j
                      </Text>
                    </View>
                    <Text style={[styles.routePrice, { color: brand }]}>
                      {formatXAF(r.basePriceXaf)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Reviews */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>
          04 — Avis voyageurs ({agency.reviews.ratingCount})
        </Text>
        {agency.reviews.items.length === 0 ? (
          <View style={styles.emptyReviews}>
            <Text style={styles.emptyReviewsText}>
              Aucun avis publié pour le moment.
            </Text>
          </View>
        ) : (
          <View style={styles.reviewGrid}>
            {agency.reviews.items.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <Text style={styles.reviewAuthor}>
                    {r.author.firstName ?? "?"} {r.author.lastName?.[0] ?? ""}.
                  </Text>
                  <Text style={styles.reviewStars}>
                    {renderStars(r.rating)}
                  </Text>
                </View>
                {r.comment ? (
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                ) : null}
                {r.punctuality != null ? (
                  <View style={styles.subScoreRow}>
                    <SubScore label="Ponctualité" value={r.punctuality} />
                    {r.comfort != null ? (
                      <SubScore label="Confort" value={r.comfort} />
                    ) : null}
                    {r.cleanliness != null ? (
                      <SubScore label="Propreté" value={r.cleanliness} />
                    ) : null}
                    {r.service != null ? (
                      <SubScore label="Service" value={r.service} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* CTA back */}
      <View style={styles.footer}>
        <Link href="/agencies" asChild>
          <Pressable accessibilityRole="link" style={styles.backLink}>
            <Text style={styles.backLinkLabel}>← Retour à l'annuaire</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.subScore}>
      <Text style={styles.subScoreLabel}>{label}</Text>
      <Text style={styles.subScoreValue}>{value}/5</Text>
    </View>
  );
}

function renderStars(rating: number): string {
  return [1, 2, 3, 4, 5]
    .map((n) => (n <= rating ? "★" : "☆"))
    .join("");
}

// Re-export unused symbols to keep the file import graph explicit.
// (ActivityIndicator was previously used inline but is no longer required.)
void 0;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 48 },
  back: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  backLabel: { fontSize: 13, color: colors.ink2, fontWeight: "500" },
  hero: {
    marginHorizontal: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 24,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  heroTagline: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 16 },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 16,
  },
  heroMeta: {},
  heroMetaValue: {
    fontSize: 18,
    fontWeight: "500",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  heroMetaLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)" },
  heroActionRow: { flexDirection: "row", gap: 8 },
  heroAction: { flex: 1 },
  heroActionGhost: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  heroActionPressed: { opacity: 0.75 },
  heroActionGhostLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  section: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 24,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 12,
  },
  subEyebrow: { marginTop: 20 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 14,
    color: colors.ink1,
    lineHeight: 20,
    marginBottom: 16,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statCell: {
    flexBasis: "50%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { fontSize: 12, color: colors.ink1 },
  chipLabelDark: { fontSize: 12, color: colors.paper, fontWeight: "500" },
  sinceLabel: { fontSize: 11, color: colors.ink2, letterSpacing: 0.5 },
  routeGrid: { gap: 8 },
  routeCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  routeCardPressed: { opacity: 0.85 },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  routeLeft: { flex: 1 },
  routeTitle: { fontSize: 15, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  routeMeta: { fontSize: 11, color: colors.ink2, letterSpacing: 0.3 },
  routePrice: {
    fontSize: 15,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  emptyReviews: {
    padding: 20,
    backgroundColor: colors.surface2,
    alignItems: "center",
  },
  emptyReviewsText: { fontSize: 13, color: colors.ink2, textAlign: "center" },
  reviewGrid: { gap: 8 },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    padding: 14,
  },
  reviewHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewAuthor: { fontSize: 13, fontWeight: "500", color: colors.ink },
  reviewStars: { fontSize: 13, color: colors.woodDark, letterSpacing: 1 },
  reviewComment: {
    fontSize: 12,
    color: colors.ink1,
    lineHeight: 17,
    marginBottom: 8,
  },
  subScoreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  subScore: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  subScoreLabel: { fontSize: 10, color: colors.ink2 },
  subScoreValue: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  backLink: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" },
  backLinkLabel: { fontSize: 12, color: colors.ink2 },
});
