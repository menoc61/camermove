import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchRental } from "@/lib/api/rentals";
import { formatXAF } from "@/lib/format";
import { motion, useReduceMotion } from "@/lib/motion";
import { useAuthStore } from "@/lib/auth/session";

function calcDuration(start: string, end: string, unit: string): number {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  const ms = b - a;
  if (ms <= 0) return 0;
  if (unit === "hour") return Math.ceil(ms / 3600000);
  if (unit === "week") return Math.ceil(ms / (86400000 * 7));
  if (unit === "month") return Math.ceil(ms / (86400000 * 30));
  return Math.ceil(ms / 86400000);
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function RentalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleId = typeof id === "string" && id.length > 0 ? id : null;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  // Motion: fade-in hero image and metadata block on mount.
  const reduceMotion = useReduceMotion();
  const heroProgress = useSharedValue(reduceMotion ? 1 : 0);
  const metaProgress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      heroProgress.value = 1;
      metaProgress.value = 1;
      return;
    }
    heroProgress.value = withTiming(1, { duration: motion.duration.base });
    metaProgress.value = withDelay(80, withTiming(1, { duration: motion.duration.base }));
  }, [heroProgress, metaProgress, reduceMotion]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaProgress.value,
    transform: [{ translateY: (1 - metaProgress.value) * 12 }],
  }));

  const query = useQuery({
    queryKey: ["rental", vehicleId],
    queryFn: () => fetchRental(vehicleId as string),
    enabled: !!vehicleId,
  });

  const duration = useMemo(() => calcDuration(startDate, endDate, query.data?.durationUnit ?? "day"), [
    startDate,
    endDate,
    query.data,
  ]);
  const total = query.data && duration > 0 ? query.data.pricePerUnit * duration : 0;

  if (!vehicleId) {
    return (
      <EmptyState
        message="Véhicule introuvable."
        actionLabel="Voir la liste"
        onAction={() => router.push("/rentals")}
      />
    );
  }

  if (query.isPending) {
    return <LoadingState label="Chargement du véhicule…" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Impossible de charger ce véhicule."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const vehicle = query.data;
  const minStart = todayIso();

  function onReserve() {
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(`/rentals/${vehicleId}`)}` as never);
      return;
    }
    if (!startDate || !endDate || duration < 1) return;
    if (pickupCity.trim() === "") return;
    router.push(
      `/rentals/${vehicleId}/book?` +
        `startDate=${encodeURIComponent(startDate)}&` +
        `endDate=${encodeURIComponent(endDate)}&` +
        `pickupCity=${encodeURIComponent(pickupCity.trim())}&` +
        `pickupAddress=${encodeURIComponent(pickupAddress.trim())}&` +
        `dropoffCity=${encodeURIComponent(dropoffCity.trim())}&` +
        `dropoffAddress=${encodeURIComponent(dropoffAddress.trim())}&` +
        `driverName=${encodeURIComponent(driverName.trim())}&` +
        `driverPhone=${encodeURIComponent(driverPhone.trim())}` as never,
    );
  }

  const datesValid = startDate !== "" && endDate !== "" && duration >= 1;
  const canSubmit = datesValid && pickupCity.trim() !== "";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {vehicle.photos && vehicle.photos.length > 0 ? (
        <Animated.View style={[styles.heroWrap, heroStyle]}>
          <Image
            source={{ uri: vehicle.photos[0] }}
            style={styles.hero}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${vehicle.make} ${vehicle.model}`}
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.heroWrap, styles.heroPlaceholder, heroStyle]}>
          <Text style={styles.heroPlaceholderText}>{vehicle.make.charAt(0)}</Text>
        </Animated.View>
      )}

      <Animated.View style={metaStyle}>
        <Text style={styles.eyebrow}>{vehicle.category}</Text>
        <Text style={styles.title}>
          {vehicle.make} {vehicle.model}
          {vehicle.year ? ` · ${vehicle.year}` : ""}
        </Text>
        <Text style={styles.meta}>
          {vehicle.capacity} places · {vehicle.pickupCity}
          {vehicle.transmission ? ` · ${vehicle.transmission}` : ""}
          {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
          {vehicle.hasDriver ? " · avec chauffeur" : ""}
        </Text>

        {vehicle.amenities && vehicle.amenities.length > 0 ? (
          <View style={styles.amenities}>
            {vehicle.amenities.slice(0, 6).map((a) => (
              <View key={a} style={styles.amenity}>
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.price}>
          {formatXAF(vehicle.pricePerUnit)} / {vehicle.durationUnit}
        </Text>
      </Animated.View>

      {vehicle.photos && vehicle.photos.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbsRow}
        >
          {vehicle.photos.slice(0, 6).map((p, i) => (
            <Image
              key={`${p}-${i}`}
              source={{ uri: p }}
              style={styles.thumb}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ))}
        </ScrollView>
      ) : null}

      <Text style={styles.sectionTitle}>Détails & conditions</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoRow}>
          <Text style={styles.infoStrong}>Capacité :</Text> {vehicle.capacity}
        </Text>
        <Text style={styles.infoRow}>
          <Text style={styles.infoStrong}>Transmission :</Text> {vehicle.transmission ?? "—"}
        </Text>
        <Text style={styles.infoRow}>
          <Text style={styles.infoStrong}>Carburant :</Text> {vehicle.fuelType ?? "—"}
        </Text>
        <Text style={styles.infoNote}>
          Le véhicule est disponible à {vehicle.pickupCity}. Annulation selon politique affichée lors du paiement.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Réserver</Text>
      <View style={styles.formCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Field
              label="Début"
              value={startDate}
              onChangeText={setStartDate}
              placeholder={minStart}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.dateCol}>
            <Field
              label="Fin"
              value={endDate}
              onChangeText={setEndDate}
              placeholder={tomorrowIso()}
              keyboardType="numeric"
            />
          </View>
        </View>
        <Field
          label="Ville retrait"
          value={pickupCity}
          onChangeText={setPickupCity}
          placeholder={vehicle.pickupCity}
          autoCapitalize="words"
        />
        <Field
          label="Adresse retrait (optionnel)"
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholder="ex : Akwa, boulevard de la liberté"
          autoCapitalize="words"
        />
        <Field
          label="Ville restitution"
          value={dropoffCity}
          onChangeText={setDropoffCity}
          placeholder={pickupCity.trim() || vehicle.pickupCity}
          autoCapitalize="words"
        />
        <Field
          label="Adresse restitution (optionnel)"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
          placeholder="ex : Bonapriso, rue…"
          autoCapitalize="words"
        />
        {vehicle.hasDriver ? (
          <>
            <Field
              label="Nom chauffeur"
              value={driverName}
              onChangeText={setDriverName}
              placeholder="ex : Jean Mbarga"
              autoCapitalize="words"
            />
            <Field
              label="Téléphone chauffeur"
              value={driverPhone}
              onChangeText={setDriverPhone}
              placeholder="+2376XXXXXXXX"
              keyboardType="phone-pad"
            />
          </>
        ) : null}

        {datesValid ? (
          <View style={styles.recap}>
            <Text style={styles.recapLabel}>
              {duration} {vehicle.durationUnit}(s) × {formatXAF(vehicle.pricePerUnit)}
            </Text>
            <Text style={styles.recapTotal}>{formatXAF(total)}</Text>
          </View>
        ) : null}

        <View style={styles.cta}>
          <Button
            label={accessToken ? "Continuer" : "Se connecter pour réserver"}
            onPress={onReserve}
            disabled={Boolean(accessToken) && !canSubmit}
          />
        </View>
        {!accessToken ? (
          <Text style={styles.helper}>Connectez-vous pour finaliser la réservation.</Text>
        ) : null}
        {/* Accessibility hint about date format (mobile-friendly, no native picker needed) */}
        <Text style={styles.helper}>
          Format : AAAA-MM-JJ. Début ≥ {minStart}.
        </Text>
      </View>

      {startDate !== "" && endDate !== "" && duration < 1 ? (
        <Text style={styles.error}>La date de fin doit être après la date de début.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 48 },
  heroWrap: { width: "100%", height: 240, backgroundColor: colors.surface2 },
  hero: { width: "100%", height: "100%" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroPlaceholderText: { fontSize: 64, fontWeight: "500", color: colors.ink2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "500",
    color: colors.ink,
    paddingHorizontal: 24,
  },
  meta: {
    fontSize: 14,
    color: colors.ink1,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  amenities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  amenity: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  amenityText: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: colors.ink1 },
  price: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.woodDark,
    paddingHorizontal: 24,
    marginTop: 16,
    fontVariant: ["tabular-nums"],
  },
  thumbsRow: { gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  thumb: {
    width: 120,
    height: 80,
    backgroundColor: colors.surface2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.ink,
    paddingHorizontal: 24,
    marginTop: 28,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginHorizontal: 24,
    gap: 8,
  },
  infoRow: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  infoStrong: { fontWeight: "500", color: colors.ink },
  infoNote: { fontSize: 13, color: colors.ink2, marginTop: 6 },
  formCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginHorizontal: 24,
  },
  dateRow: { flexDirection: "row", gap: 12 },
  dateCol: { flex: 1 },
  recap: {
    marginTop: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  recapLabel: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  recapTotal: { fontSize: 20, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  cta: { marginTop: 16 },
  helper: { fontSize: 12, color: colors.ink2, marginTop: 8, textAlign: "center" },
  error: { fontSize: 13, color: "#B3261E", marginTop: 12, paddingHorizontal: 24 },
});
