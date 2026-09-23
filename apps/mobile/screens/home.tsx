import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { formatDate, formatRelative, formatTime, formatXAF } from "@/lib/format";
import { fetchLandingRails, fetchLandingStats, type TransportRailItem } from "@/lib/api/landing";
import { fetchAgenciesList } from "@/lib/api/agencies";
import { useSearchStore } from "@/lib/stores/search";

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HomeScreen() {
  const router = useRouter();
  const { origin, destination, date, pax, setSearch } = useSearchStore();
  const [showPicker, setShowPicker] = useState(false);
  const isWeb = Platform.OS === "web";

  const statsQuery = useQuery({ queryKey: ["landing", "stats"], queryFn: fetchLandingStats });
  const railsQuery = useQuery({ queryKey: ["landing", "rails"], queryFn: () => fetchLandingRails() });
  const agenciesQuery = useQuery({
    queryKey: ["agencies", "preview"],
    queryFn: () => fetchAgenciesList(),
  });

  function openRail(item: TransportRailItem) {
    setSearch({ origin: item.origin, destination: item.destination });
    router.push("/(tabs)/search");
  }

  function openAgencies() {
    router.push("/agencies" as never);
  }

  function openAgencyDetail(id: string) {
    router.push(`/agencies/${encodeURIComponent(id)}` as never);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Réservez votre voyage</Text>

      <View style={styles.widget}>
        <Field
          label="Départ"
          value={origin}
          onChangeText={(v) => setSearch({ origin: v })}
          placeholder="Yaoundé"
          autoCapitalize="words"
        />
        <Field
          label="Destination"
          value={destination}
          onChangeText={(v) => setSearch({ destination: v })}
          placeholder="Douala"
          autoCapitalize="words"
        />
        <Text style={styles.fieldLabel}>Date de départ</Text>
        {isWeb ? (
          <Field
            label=""
            value={date}
            onChangeText={(v) => setSearch({ date: v })}
            placeholder="AAAA-MM-JJ"
          />
        ) : (
          <Pressable
            onPress={() => setShowPicker(true)}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel="Choisir la date de départ"
          >
            <Text style={styles.dateText}>{formatDay(date)}</Text>
            <Text style={styles.dateCta}>Modifier</Text>
          </Pressable>
        )}
        {showPicker && !isWeb ? (
          <DateTimePicker
            value={parseISODate(date)}
            mode="date"
            minimumDate={startOfToday()}
            locale="fr_FR"
            presentation="dialog"
            onValueChange={(_event, selected) => {
              setShowPicker(false);
              setSearch({ date: toISODate(selected) });
            }}
            onDismiss={() => setShowPicker(false)}
          />
        ) : null}
        <Text style={styles.fieldLabel}>Passagers</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setSearch({ pax: Math.max(1, pax - 1) })}
            disabled={pax <= 1}
            style={[styles.stepButton, pax <= 1 && styles.stepDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Réduire le nombre de passagers"
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{pax}</Text>
          <Pressable
            onPress={() => setSearch({ pax: Math.min(10, pax + 1) })}
            disabled={pax >= 10}
            style={[styles.stepButton, pax >= 10 && styles.stepDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Augmenter le nombre de passagers"
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.searchButton}>
          <Button label="Rechercher" onPress={() => router.push("/(tabs)/search")} />
        </View>
      </View>

      <Text style={styles.sectionEyebrow}>En bref</Text>
      {statsQuery.isPending ? (
        <ActivityIndicator color={colors.ink} style={styles.loader} />
      ) : statsQuery.isError ? (
        <ErrorState
          message="Impossible de charger les statistiques."
          onRetry={() => void statsQuery.refetch()}
        />
      ) : !statsQuery.data ? (
        <EmptyState message="Statistiques indisponibles pour le moment." />
      ) : (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {statsQuery.data.minPrice != null ? formatXAF(statsQuery.data.minPrice) : "—"}
            </Text>
            <Text style={styles.statLabel}>Prix min</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {statsQuery.data.nextDepartureAt
                ? formatRelative(statsQuery.data.nextDepartureAt)
                : "—"}
            </Text>
            <Text style={styles.statLabel}>Prochain départ</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{statsQuery.data.hotelsCount}</Text>
            <Text style={styles.statLabel}>Hôtels</Text>
          </View>
          <View style={[styles.stat, styles.statLast]}>
            <Text style={styles.statValue}>{statsQuery.data.rentalsCount}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionEyebrow}>Populaire</Text>
      <Text style={styles.sectionTitle}>Départs à venir</Text>
      {railsQuery.isPending ? (
        <ActivityIndicator color={colors.ink} style={styles.loader} />
      ) : railsQuery.isError ? (
        <ErrorState
          message="Impossible de charger les départs."
          onRetry={() => void railsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={railsQuery.data.items}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          ListEmptyComponent={
            <EmptyState message="Aucun départ à venir pour le moment." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openRail(item)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Rechercher ${item.origin} vers ${item.destination}`}
            >
              <Text style={styles.cardEyebrow}>{item.companyName}</Text>
              <Text style={styles.cardTitle}>
                {item.origin} → {item.destination}
              </Text>
              <Text style={styles.cardMeta}>
                {formatDate(item.departureAt)} · {formatTime(item.departureAt)}
              </Text>
              <Text style={styles.cardPrice}>{formatXAF(item.price)}</Text>
              <Text style={styles.cardSeats}>
                {item.seatsAvailable === 0
                  ? "Complet"
                  : item.seatsAvailable < 5
                    ? `Plus que ${item.seatsAvailable} places`
                    : `${item.seatsAvailable} places libres`}
              </Text>
              <Text style={styles.cardCta}>Rechercher ce trajet</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.agencyHeaderRow}>
        <View style={styles.agencyHeaderLeft}>
          <Text style={styles.sectionEyebrow}>Annuaire</Text>
          <Text style={styles.sectionTitle}>Nos agences partenaires</Text>
        </View>
        <Pressable
          onPress={openAgencies}
          accessibilityRole="link"
          accessibilityLabel="Voir tout l'annuaire"
          hitSlop={8}
        >
          <Text style={styles.seeAllLink}>Tout voir →</Text>
        </Pressable>
      </View>
      {agenciesQuery.isPending ? (
        <ActivityIndicator color={colors.ink} style={styles.loader} />
      ) : agenciesQuery.isError ? (
        <ErrorState
          message="Impossible de charger les agences."
          onRetry={() => void agenciesQuery.refetch()}
        />
      ) : (
        <FlatList
          data={agenciesQuery.data?.items.slice(0, 6) ?? []}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          ListEmptyComponent={
            <EmptyState message="Aucune agence référencée pour le moment." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openAgencyDetail(item.id)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Voir ${item.companyName}`}
            >
              <Text style={styles.cardEyebrow}>{item.city ?? "Cameroun"}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.companyName}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={2}>
                {item.tagline}
              </Text>
              <Text style={styles.cardPrice}>
                {item.ratingAvg != null ? `${item.ratingAvg.toFixed(1)} ★` : "Nouveau"}
              </Text>
              <Text style={styles.cardSeats}>
                {item.routes.length} ligne{item.routes.length > 1 ? "s" : ""} ·{" "}
                {item.fleetCount} bus
              </Text>
              <Text style={styles.cardCta}>Voir l'agence</Text>
            </Pressable>
          )}
        />
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  widget: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 0,
  },
  dateText: { fontSize: 16, color: colors.ink },
  dateCta: { fontSize: 14, color: colors.woodDark },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  stepButton: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 0,
    paddingHorizontal: 12,
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: 20, color: colors.ink },
  stepValue: { fontSize: 18, color: colors.ink, fontVariant: ["tabular-nums"] },
  searchButton: { marginTop: 8 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 22, fontWeight: "500", color: colors.ink, marginBottom: 16 },
  loader: { marginVertical: 24 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    marginBottom: 32,
  },
  stat: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  statLast: { borderRightWidth: 0 },
  statValue: { fontSize: 15, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, color: colors.ink2, marginTop: 4, textAlign: "center" },
  railList: { gap: 12, paddingRight: 24 },
  card: {
    width: 240,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  cardMeta: { fontSize: 13, color: colors.ink2, marginBottom: 8 },
  cardPrice: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.woodDark,
    fontVariant: ["tabular-nums"],
    marginBottom: 4,
  },
  cardSeats: { fontSize: 13, color: colors.ink2, marginBottom: 12 },
  cardCta: { fontSize: 12, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase", color: colors.ink },
  agencyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    marginTop: 8,
  },
  agencyHeaderLeft: { flex: 1, marginRight: 12 },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.woodDark,
  },
});
