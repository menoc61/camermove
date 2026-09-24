import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { fetchHotel, type HotelItem, type HotelRoom } from "@/lib/api/hotels";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { motion, useReduceMotion } from "@/lib/motion";

function Hero({ photo, name }: { photo: string | null; name: string }) {
  const opacity = useSharedValue(0);
  const reduced = useReduceMotion();
  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: reduced ? 0 : motion.duration.slow,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.hero, style]} accessibilityLabel={`Photo de ${name}`}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.heroImage} resizeMode="cover" />
      ) : (
        <View style={[styles.heroImage, styles.heroFallback]}>
          <Text style={styles.heroFallbackLabel}>Hôtel</Text>
        </View>
      )}
    </Animated.View>
  );
}

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const d = Math.round((b - a) / 86_400_000);
  return d > 0 ? d : 0;
}

export function HotelDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : null;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const hotelQuery = useQuery({
    queryKey: ["hotel", id],
    queryFn: () => fetchHotel(id as string),
    enabled: !!id,
  });

  const nights = useMemo(() => computeNights(checkIn, checkOut), [checkIn, checkOut]);
  const selectedRoomDetail = useMemo<HotelRoom | null>(() => {
    if (!hotelQuery.data || !selectedRoom) return null;
    return hotelQuery.data.rooms.find((r) => r.id === selectedRoom) ?? null;
  }, [hotelQuery.data, selectedRoom]);

  const total = selectedRoomDetail && nights > 0 ? selectedRoomDetail.pricePerNight * nights : 0;

  if (!id) {
    return (
      <EmptyState
        message="Hôtel introuvable."
        actionLabel="Retour aux hôtels"
        onAction={() => router.push("/hotels")}
      />
    );
  }

  if (hotelQuery.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonHero />
          <View style={styles.body}>
            <SkeletonText lines={4} />
          </View>
        </View>
      </View>
    );
  }

  if (hotelQuery.isError || !hotelQuery.data) {
    return (
      <ErrorState message="Impossible de charger cet hôtel." onRetry={() => void hotelQuery.refetch()} />
    );
  }

  const hotel: HotelItem = hotelQuery.data;
  const heroPhoto = hotel.photos?.[0] ?? null;
  const hasRooms = hotel.rooms.length > 0;

  function buildBookHref(): string {
    const qs = new URLSearchParams({
      hotelId: id as string,
      ...(selectedRoom ? { roomTypeId: selectedRoom } : {}),
      checkIn,
      checkOut,
      guests: String(guests),
    });
    return `/hotels/${id}/book?${qs.toString()}`;
  }

  function reserve() {
    if (!selectedRoom) {
      toast("Choisissez une chambre.");
      return;
    }
    if (!checkIn || !checkOut || nights < 1) {
      toast("Dates invalides.");
      return;
    }
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(buildBookHref())}` as never);
      return;
    }
    router.push(buildBookHref() as never);
  }

  function ctaLabel(): string {
    if (selectedRoom && nights > 0) return `Réserver — ${formatXAF(total)}`;
    if (!selectedRoom) return "Choisir une chambre";
    if (nights < 1) return "Choisir les dates";
    return "Réserver";
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Hero photo={heroPhoto} name={hotel.name} />

      <View style={styles.body}>
        <Reveal>
          <Text style={styles.eyebrow}>
            {hotel.city}
            {hotel.region ? ` · ${hotel.region}` : ""}
          </Text>
          <Text style={styles.title}>{hotel.name}</Text>
          {hotel.starRating ? <Text style={styles.stars}>{"★".repeat(hotel.starRating)}</Text> : null}
          {hotel.description ? <Text style={styles.description}>{hotel.description}</Text> : null}
          {hotel.amenities.length > 0 ? (
            <View style={styles.amenities}>
              {hotel.amenities.map((a) => (
                <Text key={a} style={styles.amenityChip}>
                  {a}
                </Text>
              ))}
            </View>
          ) : null}
        </Reveal>

        {hotel.photos.length > 1 ? (
          <Reveal delay={60}>
            <View style={styles.gallery}>
              {hotel.photos.slice(1, 5).map((p) => (
                <Image key={p} source={{ uri: p }} style={styles.galleryImage} resizeMode="cover" />
              ))}
            </View>
          </Reveal>
        ) : null}

        <Reveal delay={120}>
          <Text style={styles.sectionTitle}>Chambres</Text>
          {!hasRooms ? (
            <Text style={styles.muted}>Aucune chambre disponible pour le moment.</Text>
          ) : (
            hotel.rooms.map((r, i) => (
              <Reveal key={r.id} delay={140 + i * 50}>
                <RoomRow
                  room={r}
                  selected={selectedRoom === r.id}
                  onSelect={() => setSelectedRoom(r.id)}
                />
              </Reveal>
            ))
          )}
        </Reveal>

        <Reveal delay={200}>
          <Text style={styles.sectionTitle}>Réserver</Text>
          <View style={styles.bookBox}>
            <View style={styles.dateRow}>
              <View style={styles.dateCell}>
                <Text style={styles.fieldLabel}>Arrivée</Text>
                <TextInput
                  value={checkIn}
                  onChangeText={setCheckIn}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={colors.ink2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  style={styles.dateTextInput}
                />
              </View>
              <View style={styles.dateCell}>
                <Text style={styles.fieldLabel}>Départ</Text>
                <TextInput
                  value={checkOut}
                  onChangeText={setCheckOut}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={colors.ink2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  style={styles.dateTextInput}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Voyageurs</Text>
            <View style={styles.stepper}>
              <AnimatedPressFeedback
                onPress={() => setGuests((n) => Math.max(1, n - 1))}
                disabled={guests <= 1}
                style={[styles.step, guests <= 1 && styles.stepDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Réduire le nombre de voyageurs"
              >
                <Text style={styles.stepText}>−</Text>
              </AnimatedPressFeedback>
              <Text style={styles.stepValue}>{guests}</Text>
              <AnimatedPressFeedback
                onPress={() => setGuests((n) => Math.min(10, n + 1))}
                disabled={guests >= 10}
                style={[styles.step, guests >= 10 && styles.stepDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Augmenter le nombre de voyageurs"
              >
                <Text style={styles.stepText}>+</Text>
              </AnimatedPressFeedback>
            </View>

            {nights > 0 && selectedRoomDetail ? (
              <Text style={styles.recap}>
                {nights} nuit{nights > 1 ? "s" : ""} × {formatXAF(selectedRoomDetail.pricePerNight)} ={" "}
                <Text style={styles.recapTotal}>{formatXAF(total)}</Text>
              </Text>
            ) : null}

            <ActionButton
              label={ctaLabel()}
              onPress={reserve}
              disabled={!hasRooms || !selectedRoom || nights < 1}
              successLabel="Redirection…"
            />
            {!accessToken ? (
              <Text style={styles.authHint}>Connectez-vous pour finaliser la réservation.</Text>
            ) : null}
          </View>
        </Reveal>
      </View>
    </ScrollView>
  );
}

function RoomRow({ room, selected, onSelect }: { room: HotelRoom; selected: boolean; onSelect: () => void }) {
  return (
    <View style={[styles.roomRow, selected && styles.roomRowSelected]}>
      <View style={styles.roomMain}>
        <Text style={styles.roomName}>{room.name}</Text>
        <Text style={styles.roomMeta}>
          {room.capacity} pers. · {room.bedType ?? "—"} · ×{room.quantity}
        </Text>
        {room.amenities.length > 0 ? (
          <Text style={styles.roomAmenities} numberOfLines={1}>
            {room.amenities.slice(0, 4).join(" · ")}
          </Text>
        ) : null}
        <Text style={styles.roomPrice}>
          {formatXAF(room.pricePerNight)} / nuit
        </Text>
      </View>
      <AnimatedPressFeedback
        onPress={onSelect}
        style={[styles.roomSelect, selected && styles.roomSelectActive]}
        accessibilityRole="button"
        accessibilityLabel={selected ? "Chambre sélectionnée" : "Choisir cette chambre"}
        accessibilityState={{ selected }}
      >
        <Text style={[styles.roomSelectLabel, selected && styles.roomSelectLabelActive]}>
          {selected ? "Sélectionnée" : "Choisir"}
        </Text>
      </AnimatedPressFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 48 },
  hero: { width: "100%", height: 240, backgroundColor: colors.surface2, marginBottom: 24 },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  heroFallbackLabel: {
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  body: { paddingHorizontal: 24 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  stars: { fontSize: 14, color: colors.woodDark, marginBottom: 12 },
  description: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginBottom: 12 },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  amenityChip: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink1,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  galleryImage: { width: "48%", aspectRatio: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  muted: { fontSize: 14, color: colors.ink2 },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  roomRowSelected: { borderColor: colors.ink },
  roomMain: { flex: 1, gap: 4 },
  roomName: { fontSize: 16, fontWeight: "500", color: colors.ink },
  roomMeta: { fontSize: 13, color: colors.ink2 },
  roomAmenities: { fontSize: 12, color: colors.ink2, marginTop: 4 },
  roomPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.woodDark,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  roomSelect: {
    minWidth: 96,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  roomSelectActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  roomSelectLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  roomSelectLabelActive: { color: colors.paper },
  bookBox: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 12,
  },
  dateRow: { flexDirection: "row", gap: 12 },
  dateCell: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  dateTextInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  step: {
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
  recap: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  recapTotal: { fontWeight: "500", color: colors.ink },
  authHint: { fontSize: 12, color: colors.ink2, textAlign: "center" },
});
