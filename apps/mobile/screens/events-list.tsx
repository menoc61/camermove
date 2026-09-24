import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonRail } from "@/components/ui/skeleton-presets";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchEvents, type Event, type EventSearchQuery } from "@/lib/api/events";
import { formatDate, formatXAF } from "@/lib/format";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatEventDateRange(start: string, end: string | null): string {
  const s = new Date(start);
  if (end) {
    const e = new Date(end);
    return `${s.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return s.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function EventsListScreen() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params: EventSearchQuery = useMemo(
    () => ({
      city: city.trim() === "" ? undefined : city.trim(),
      eventType: eventType.trim() === "" ? undefined : eventType.trim(),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      q: q.trim() === "" ? undefined : q.trim(),
      page,
      perPage: 20,
    }),
    [city, eventType, dateFrom, dateTo, q, page],
  );

  const list = useQuery({
    queryKey: ["events", params],
    queryFn: () => fetchEvents(params),
    placeholderData: (prev) => prev,
  });

  function resetFilters() {
    setCity("");
    setEventType("");
    setDateFrom(todayISO());
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
          <Text style={styles.eyebrow}>Événements</Text>
          <Text style={styles.title}>Concerts, festivals & spectacles</Text>
          <Text style={styles.subtitle}>
            Découvrez les événements à venir près de chez vous.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={60}>
        <View style={styles.filters}>
          <Field
            label="Ville"
            value={city}
            onChangeText={(v) => { setCity(v); setPage(1); }}
            placeholder="ex : Douala"
            autoCapitalize="words"
          />
          <Field
            label="Type"
            value={eventType}
            onChangeText={(v) => { setEventType(v); setPage(1); }}
            placeholder="ex : concert, festival"
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
            placeholder="Nom de l'événement"
            autoCapitalize="words"
          />
        </View>
      </Reveal>

      <Reveal delay={120}>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            <Text style={styles.summaryBold}>{total}</Text> événement{total > 1 ? "s" : ""}
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
          <SkeletonRail count={4} />
        </View>
      ) : list.isError ? (
        <View style={styles.listWrap}>
          <ErrorState
            message="Impossible de charger les événements."
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
              message="Aucun événement ne correspond à ces critères."
              actionLabel="Voir tout"
              onAction={resetFilters}
            />
          }
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 6) * 50}>
              <EventCard event={item} onPress={() => router.push(`/events/${encodeURIComponent(item.id)}` as never)} />
            </Reveal>
          )}
        />
      )}
    </View>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const lowestPrice = event.ticketCategories && event.ticketCategories.length > 0
    ? Math.min(...event.ticketCategories.map((c) => c.price))
    : null;
  const available = event.ticketCategories && event.ticketCategories.length > 0
    ? event.ticketCategories.reduce((sum, c) => sum + c.available, 0)
    : 0;

  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${event.name} à ${event.city}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Text style={styles.cardEyebrow}>
            {event.city}
            {event.venue ? ` · ${event.venue}` : ""}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {event.name}
          </Text>
        </View>
        {event.posterUrl ? null : <Text style={styles.eventIcon}>🎟</Text>}
      </View>

      <Text style={styles.cardDate}>{formatEventDateRange(event.startDate, event.endDate)}</Text>

      {event.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}

      <View style={styles.cardFoot}>
        <Text style={styles.cardMeta}>
          {event.eventType} · {available} place{available > 1 ? "s" : ""} dispo
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
  eventIcon: { fontSize: 24 },
  cardDate: { fontSize: 13, color: colors.ink1, marginBottom: 8, fontVariant: ["tabular-nums"] },
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