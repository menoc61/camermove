import DateTimePicker from "@expo/ui/community/datetime-picker";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { Field } from "@/components/ui/text-input";
import {
  EmptyState,
  ErrorState,
} from "@/components/ui/screen-state";
import {
  SkeletonCard,
  SkeletonRail,
  SkeletonStats,
} from "@/components/ui/skeleton-presets";
import { StatIndicator } from "@/components/ui/stat-indicator";
import { Reveal } from "@/components/ui/reveal";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { HeartToggle } from "@/components/ui/heart-toggle";
import { IconButton } from "@/components/ui/icon-button";
import { LottieIllustration } from "@/components/ui/lottie-illustration";
import { colors } from "@/constants/theme";
import { formatDate, formatRelative, formatTime, formatXAF } from "@/lib/format";
import {
  fetchLandingRails,
  fetchLandingStats,
  type HotelRailItem,
  type RentalRailItem,
  type TransportRailItem,
} from "@/lib/api/landing";
import { fetchAgenciesList, type AgencyListItem } from "@/lib/api/agencies";
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
  return new Date(d);
}

function formatDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const RAIL_CARD_HEIGHT = 188;
const RAIL_CARD_WIDTH = 248;

export function HomeScreen() {
  const router = useRouter();
  const { origin, destination, date, pax, setSearch } = useSearchStore();
  const [showPicker, setShowPicker] = useState(false);
  const isWeb = Platform.OS === "web";

  const statsQuery = useQuery({
    queryKey: ["landing", "stats"],
    queryFn: fetchLandingStats,
  });
  const railsQuery = useQuery({
    queryKey: ["landing", "rails"],
    queryFn: () => fetchLandingRails(),
  });
  const rentalsRailQuery = useQuery({
    queryKey: ["landing", "rails", "rentals"],
    queryFn: () => fetchLandingRails("rentals"),
  });
  const hotelsRailQuery = useQuery({
    queryKey: ["landing", "rails", "hotels"],
    queryFn: () => fetchLandingRails("hotels"),
  });
  const agenciesQuery = useQuery({
    queryKey: ["agencies", "preview"],
    queryFn: () => fetchAgenciesList(),
  });

  const railRef = useRef<FlashListRef<TransportRailItem>>(null);
  const rentalsRef = useRef<FlashListRef<RentalRailItem>>(null);
  const hotelsRef = useRef<FlashListRef<HotelRailItem>>(null);
  const agenciesRef = useRef<FlashListRef<AgencyListItem>>(null);

  const tripItems = useMemo(
    () => railsQuery.data?.items ?? [],
    [railsQuery.data],
  );
  const rentalItems = useMemo(
    () =>
      rentalsRailQuery.data && rentalsRailQuery.data.type === "rentals"
        ? rentalsRailQuery.data.items
        : [],
    [rentalsRailQuery.data],
  );
  const hotelItems = useMemo(
    () =>
      hotelsRailQuery.data && hotelsRailQuery.data.type === "hotels"
        ? hotelsRailQuery.data.items
        : [],
    [hotelsRailQuery.data],
  );
  const agencyItems = useMemo(
    () => agenciesQuery.data?.items.slice(0, 6) ?? [],
    [agenciesQuery.data],
  );

  function openRail(item: TransportRailItem) {
    setSearch({ origin: item.origin, destination: item.destination });
    router.push("/(tabs)/search");
  }

  function openRentalsList() {
    router.push("/rentals" as never);
  }
  function openRental(item: RentalRailItem) {
    router.push(`/rentals/${encodeURIComponent(item.id)}` as never);
  }
  function openHotelsList() {
    router.push("/hotels" as never);
  }
  function openHotel(item: HotelRailItem) {
    router.push(`/hotels/${encodeURIComponent(item.id)}` as never);
  }
  function openAgencies() {
    router.push("/agencies" as never);
  }
  function openAgencyDetail(id: string) {
    router.push(`/agencies/${encodeURIComponent(id)}` as never);
  }

  async function submitSearch() {
    router.push("/(tabs)/search");
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Reveal>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CamerMove</Text>
            <Text style={styles.title}>Réservez votre voyage</Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              name="refresh"
              variant="subtle"
              accessibilityLabel="Rafraîchir les données"
              onPress={() => {
                void statsQuery.refetch();
                void railsQuery.refetch();
                void agenciesQuery.refetch();
              }}
            />
            <IconButton
              name="ticket"
              variant="subtle"
              accessibilityLabel="Voir mes billets"
              onPress={() => router.push("/(tabs)/tickets" as never)}
            />
          </View>
        </View>
      </Reveal>

      <Reveal delay={60}>
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
            <AnimatedPressFeedback
              onPress={() => setShowPicker(true)}
              style={styles.dateButton}
              accessibilityRole="button"
              accessibilityLabel="Choisir la date de départ"
            >
              <Text style={styles.dateText}>{formatDay(date)}</Text>
              <Text style={styles.dateCta}>Modifier</Text>
            </AnimatedPressFeedback>
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
            <AnimatedPressFeedback
              onPress={() => setSearch({ pax: Math.max(1, pax - 1) })}
              disabled={pax <= 1}
              style={[styles.stepButton, pax <= 1 && styles.stepDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Réduire le nombre de passagers"
            >
              <Text style={styles.stepText}>−</Text>
            </AnimatedPressFeedback>
            <Text style={styles.stepValue}>{pax}</Text>
            <AnimatedPressFeedback
              onPress={() => setSearch({ pax: Math.min(10, pax + 1) })}
              disabled={pax >= 10}
              style={[styles.stepButton, pax >= 10 && styles.stepDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Augmenter le nombre de passagers"
            >
              <Text style={styles.stepText}>+</Text>
            </AnimatedPressFeedback>
          </View>
          <View style={styles.searchButton}>
            <ActionButton
              label="Rechercher"
              onPress={submitSearch}
              successLabel="C'est parti"
            />
          </View>
        </View>
      </Reveal>

      <Reveal delay={120}>
        <Text style={styles.sectionEyebrow}>En bref</Text>
      </Reveal>
      {statsQuery.isPending ? (
        <SkeletonStats />
      ) : statsQuery.isError ? (
        <ErrorState
          message="Impossible de charger les statistiques."
          onRetry={() => void statsQuery.refetch()}
        />
      ) : !statsQuery.data ? (
        <EmptyState message="Statistiques indisponibles pour le moment." />
      ) : (
        <View style={styles.statsRow}>
          <StatIndicator
            label="Prix min"
            value={
              statsQuery.data.minPrice != null
                ? formatXAF(statsQuery.data.minPrice)
                : "—"
            }
            tooltip="Le tarif le plus bas trouvé sur les 7 prochains jours, tous transporteurs confondus."
            loading={statsQuery.isFetching && !statsQuery.data}
          />
          <StatIndicator
            label="Prochain départ"
            value={
              statsQuery.data.nextDepartureAt
                ? formatRelative(statsQuery.data.nextDepartureAt)
                : "—"
            }
            tooltip="Le prochain départ confirmé sur n'importe quel trajet interurbain."
            loading={statsQuery.isFetching && !statsQuery.data}
          />
          <StatIndicator
            label="Hôtels"
            value={statsQuery.data.hotelsCount.toString()}
            tooltip="Nombre d'hôtels et appart-hôtels référencés par CamerMove."
          />
          <StatIndicator
            label="Locations"
            value={statsQuery.data.rentalsCount.toString()}
            tooltip="Véhicules de location disponibles via nos agences partenaires."
          />
        </View>
      )}

      <SectionHeader
        eyebrow="Populaire"
        title="Départs à venir"
        onSeeAll={() => router.push("/(tabs)/search")}
        ctaLabel="Rechercher"
      />
      {railsQuery.isPending ? (
        <SkeletonRail count={4} />
      ) : railsQuery.isError ? (
        <ErrorState
          message="Impossible de charger les départs."
          onRetry={() => void railsQuery.refetch()}
        />
      ) : (
        <FlashList
          ref={railRef}
          data={tripItems}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          renderItem={({ item }) => <TripCard trip={item} onPress={() => openRail(item)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState message="Aucun départ à venir pour le moment." />
            </View>
          }
        />
      )}

      <SectionHeader
        eyebrow="Mobilité"
        title="Location véhicules"
        onSeeAll={openRentalsList}
        ctaLabel="Tout voir"
      />
      {rentalsRailQuery.isPending ? (
        <SkeletonRail count={4} />
      ) : rentalsRailQuery.isError ? (
        <ErrorState
          message="Impossible de charger les véhicules."
          onRetry={() => void rentalsRailQuery.refetch()}
        />
      ) : (
        <FlashList
          ref={rentalsRef}
          data={rentalItems}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          renderItem={({ item }) => (
            <RentalCard rental={item} onPress={() => openRental(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                message="Aucun véhicule en avant."
                actionLabel="Voir les locations"
                onAction={openRentalsList}
              />
            </View>
          }
        />
      )}

      <SectionHeader
        eyebrow="Hébergement"
        title="Hôtels & apparts"
        onSeeAll={openHotelsList}
        ctaLabel="Tout voir"
      />
      {hotelsRailQuery.isPending ? (
        <SkeletonRail count={4} />
      ) : hotelsRailQuery.isError ? (
        <ErrorState
          message="Impossible de charger les hôtels."
          onRetry={() => void hotelsRailQuery.refetch()}
        />
      ) : (
        <FlashList
          ref={hotelsRef}
          data={hotelItems}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          renderItem={({ item }) => (
            <HotelCard hotel={item} onPress={() => openHotel(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                message="Aucun hôtel en avant."
                actionLabel="Voir les hôtels"
                onAction={openHotelsList}
              />
            </View>
          }
        />
      )}

      <SectionHeader
        eyebrow="Annuaire"
        title="Nos agences partenaires"
        onSeeAll={openAgencies}
        ctaLabel="Tout voir"
      />
      {agenciesQuery.isPending ? (
        <SkeletonRail count={4} />
      ) : agenciesQuery.isError ? (
        <ErrorState
          message="Impossible de charger les agences."
          onRetry={() => void agenciesQuery.refetch()}
        />
      ) : (
        <FlashList
          ref={agenciesRef}
          data={agencyItems}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          renderItem={({ item }) => (
            <AgencyCardLite
              id={item.id}
              city={item.city ?? "Cameroun"}
              name={item.companyName}
              tagline={item.tagline}
              rating={item.ratingAvg}
              routeCount={item.routes.length}
              fleetCount={item.fleetCount}
              onPress={() => openAgencyDetail(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState message="Aucune agence référencée pour le moment." />
            </View>
          }
        />
      )}
    </ScrollView>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  ctaLabel: string;
  onSeeAll: () => void;
}
function SectionHeader({ eyebrow, title, ctaLabel, onSeeAll }: SectionHeaderProps) {
  return (
    <Reveal delay={40}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadLeft}>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <AnimatedPressFeedback
          onPress={onSeeAll}
          accessibilityRole="link"
          accessibilityLabel={ctaLabel}
          hitSlop={8}
          style={styles.seeAllPressable}
        >
          <Text style={styles.seeAllLink}>{ctaLabel} →</Text>
        </AnimatedPressFeedback>
      </View>
    </Reveal>
  );
}

interface CardProps {
  onPress: () => void;
}
function TripCard({ trip, onPress }: CardProps & { trip: TransportRailItem }) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Rechercher ${trip.origin} vers ${trip.destination}`}
    >
      <Text style={styles.cardEyebrow}>{trip.companyName}</Text>
      <Text style={styles.cardTitle}>
        {trip.origin} → {trip.destination}
      </Text>
      <Text style={styles.cardMeta}>
        {formatDate(trip.departureAt)} · {formatTime(trip.departureAt)}
      </Text>
      <Text style={styles.cardPrice}>{formatXAF(trip.price)}</Text>
      <Text style={styles.cardSeats}>
        {trip.seatsAvailable === 0
          ? "Complet"
          : trip.seatsAvailable < 5
            ? `Plus que ${trip.seatsAvailable} places`
            : `${trip.seatsAvailable} places libres`}
      </Text>
      <Text style={styles.cardCta}>Rechercher ce trajet</Text>
    </AnimatedPressFeedback>
  );
}
function RentalCard({ rental, onPress }: CardProps & { rental: RentalRailItem }) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${rental.title}`}
    >
      <Text style={styles.cardEyebrow}>{rental.top}</Text>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {rental.title}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={2}>
        {rental.bottom}
      </Text>
      <Text style={styles.cardCta}>Réserver →</Text>
    </AnimatedPressFeedback>
  );
}
function HotelCard({ hotel, onPress }: CardProps & { hotel: HotelRailItem }) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${hotel.name} à ${hotel.city}`}
    >
      <Text style={styles.cardEyebrow}>
        {hotel.city}
        {hotel.starRating ? ` · ${"★".repeat(hotel.starRating)}` : ""}
      </Text>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {hotel.name}
      </Text>
      <Text style={styles.cardPrice}>
        {hotel.fromPrice != null
          ? `${formatXAF(hotel.fromPrice)} / nuit`
          : "Voir disponibilités"}
      </Text>
      <Text style={styles.cardCta}>Réserver →</Text>
    </AnimatedPressFeedback>
  );
}
function AgencyCardLite({
  id,
  city,
  name,
  tagline,
  rating,
  routeCount,
  fleetCount,
  onPress,
}: {
  id: string;
  city: string;
  name: string;
  tagline: string;
  rating: number | null;
  routeCount: number;
  fleetCount: number;
  onPress: () => void;
}) {
  void id;
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${name}`}
    >
      <Text style={styles.cardEyebrow}>{city}</Text>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={2}>
        {tagline}
      </Text>
      <Text style={styles.cardPrice}>
        {rating != null ? `${rating.toFixed(1)} ★` : "Nouveau"}
      </Text>
      <Text style={styles.cardSeats}>
        {routeCount} ligne{routeCount > 1 ? "s" : ""} · {fleetCount} bus
      </Text>
      <Text style={styles.cardCta}>Voir l'agence</Text>
    </AnimatedPressFeedback>
  );
}

// `SkeletonCard` is exported by the skeleton-presets module; import is kept
// explicit so future rails (e.g. events / parcels) can drop it in without
// re-importing.
void SkeletonCard;
void RAIL_CARD_HEIGHT;

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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
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
    minHeight: 44,
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.ink,
    marginBottom: 16,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeadLeft: { flex: 1, marginRight: 12 },
  seeAllPressable: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 32,
    justifyContent: "center",
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.woodDark,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    marginBottom: 32,
  },
  railList: { gap: 12, paddingRight: 24, paddingVertical: 4 },
  emptyWrap: { paddingVertical: 12 },
  card: {
    width: RAIL_CARD_WIDTH,
    minHeight: RAIL_CARD_HEIGHT,
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
});
