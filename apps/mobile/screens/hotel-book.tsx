import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createHotelBooking, fetchHotel, type HotelRoom } from "@/lib/api/hotels";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const d = Math.round((b - a) / 86_400_000);
  return d > 0 ? d : 0;
}

function bookingErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return "Plus de chambres disponibles";
  if (e instanceof ApiError && e.status === 429) return "Trop de requêtes";
  if (e instanceof Error && e.message) return e.message;
  return "Échec de la réservation.";
}

export function HotelBookScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    id: string;
    hotelId?: string;
    roomTypeId?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>();
  const hotelId =
    typeof params.hotelId === "string" && params.hotelId.length > 0
      ? params.hotelId
      : typeof params.id === "string" && params.id.length > 0
        ? params.id
        : null;
  const initialRoomId = typeof params.roomTypeId === "string" ? params.roomTypeId : "";
  const initialCheckIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const initialCheckOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const initialGuests = (() => {
    const n = Number(params.guests);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 2;
  })();

  const accessToken = useAuthStore((s) => s.accessToken);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [roomTypeId, setRoomTypeId] = useState(initialRoomId);
  const [guestNames, setGuestNames] = useState<string[]>(() =>
    Array.from({ length: initialGuests }, () => ""),
  );
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!accessToken && hotelId) {
      const next = `/hotels/${hotelId}/book?hotelId=${encodeURIComponent(hotelId)}${
        roomTypeId ? `&roomTypeId=${encodeURIComponent(roomTypeId)}` : ""
      }&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`;
      router.replace(`/login?next=${encodeURIComponent(next)}` as never);
    }
  }, [accessToken, hotelId, router, roomTypeId, checkIn, checkOut, guests]);

  const hotelQuery = useQuery({
    queryKey: ["hotel", hotelId],
    queryFn: () => fetchHotel(hotelId as string),
    enabled: !!hotelId,
  });

  const nights = useMemo(() => computeNights(checkIn, checkOut), [checkIn, checkOut]);
  const selectedRoom = useMemo<HotelRoom | null>(() => {
    if (!hotelQuery.data) return null;
    if (roomTypeId) {
      return hotelQuery.data.rooms.find((r) => r.id === roomTypeId) ?? null;
    }
    return hotelQuery.data.rooms[0] ?? null;
  }, [hotelQuery.data, roomTypeId]);

  const total = selectedRoom && nights > 0 ? selectedRoom.pricePerNight * nights : 0;

  // Keep guestNames length in sync with guests count.
  useEffect(() => {
    setGuestNames((prev) => {
      if (prev.length === guests) return prev;
      if (prev.length < guests) return [...prev, ...Array.from({ length: guests - prev.length }, () => "")];
      return prev.slice(0, guests);
    });
  }, [guests]);

  const bookingMutation = useMutation({
    mutationFn: () =>
      createHotelBooking(accessToken as string, {
        hotelId: hotelId as string,
        roomTypeId: (selectedRoom?.id ?? roomTypeId) as string,
        checkIn,
        checkOut,
        guests,
        guestNames: guestNames.map((n) => n.trim()).filter((n) => n !== ""),
        ...(specialRequests.trim() === "" ? {} : { specialRequests: specialRequests.trim() }),
      }),
    onSuccess: (booking) => {
      router.replace(`/hotels/confirmation?id=${encodeURIComponent(booking.id)}` as never);
    },
    onError: (e) => {
      toast(bookingErrorMessage(e));
    },
  });

  if (!hotelId) {
    return (
      <EmptyState
        message="Hôtel introuvable."
        actionLabel="Retour aux hôtels"
        onAction={() => router.push("/hotels")}
      />
    );
  }

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour réserver cette chambre."
          actionLabel="Se connecter"
          onAction={() => router.push("/hotels")}
        />
      </View>
    );
  }

  if (hotelQuery.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonHero />
          <View style={{ marginTop: 16 }}>
            <SkeletonText lines={5} />
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

  const hotel = hotelQuery.data;
  const roomForBook = selectedRoom ?? hotel.rooms[0];

  function chooseRoom(id: string) {
    setRoomTypeId(id);
  }

  function submit() {
    setSubmitted(true);
    if (!roomForBook) {
      toast("Aucune chambre sélectionnée.");
      return;
    }
    if (!checkIn || !checkOut || nights < 1) {
      toast("Dates invalides.");
      return;
    }
    if (roomForBook.capacity < guests) {
      toast(`Cette chambre accueille ${roomForBook.capacity} pers. max.`);
      return;
    }
    if (bookingMutation.isPending) return;
    bookingMutation.mutate();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Reveal>
        <Text style={styles.eyebrow}>Réservation hôtel</Text>
        <Text style={styles.title}>{hotel.name}</Text>
        <Text style={styles.meta}>
          {hotel.city}
          {hotel.starRating ? ` · ${"★".repeat(hotel.starRating)}` : ""}
        </Text>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <Text style={styles.sectionTitle}>Chambre</Text>
        {hotel.rooms.length === 0 ? (
          <Text style={styles.muted}>Aucune chambre disponible.</Text>
        ) : (
          hotel.rooms.map((r, i) => (
            <Reveal key={r.id} delay={motion.stagger(Math.min(i, 3))}>
              <PressableRoom
                room={r}
                selected={(roomForBook?.id ?? null) === r.id}
                onPress={() => chooseRoom(r.id)}
              />
            </Reveal>
          ))
        )}
      </Reveal>

      <Reveal delay={motion.stagger(2)}>
        <Text style={styles.sectionTitle}>Dates & voyageurs</Text>
        <Field
          label="Arrivée (AAAA-MM-JJ)"
          value={checkIn}
          onChangeText={setCheckIn}
          placeholder="2026-10-01"
          autoCapitalize="none"
          autoCorrect={false}
          error={submitted && !checkIn ? "Date requise" : undefined}
        />
        <Field
          label="Départ (AAAA-MM-JJ)"
          value={checkOut}
          onChangeText={setCheckOut}
          placeholder="2026-10-05"
          autoCapitalize="none"
          autoCorrect={false}
          error={submitted && (!checkOut || nights < 1) ? "Date invalide" : undefined}
        />

        <Text style={styles.fieldLabel}>Voyageurs</Text>
        <View style={styles.stepper}>
          <PressableStep
            label="Réduire le nombre de voyageurs"
            onPress={() => setGuests((n) => Math.max(1, n - 1))}
            disabled={guests <= 1}
            symbol="−"
          />
          <Text style={styles.stepValue}>{guests}</Text>
          <PressableStep
            label="Augmenter le nombre de voyageurs"
            onPress={() => setGuests((n) => Math.min(10, n + 1))}
            disabled={guests >= 10}
            symbol="+"
          />
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(3)}>
        <Text style={styles.sectionTitle}>Noms des voyageurs</Text>
        {guestNames.map((name, i) => (
          <Field
            key={i}
            label={`Voyageur ${i + 1}`}
            value={name}
            onChangeText={(v) =>
              setGuestNames((prev) => {
                const a = [...prev];
                a[i] = v;
                return a;
              })
            }
            placeholder="ex : Amina Mbarga"
            autoCapitalize="words"
          />
        ))}

        <Field
          label="Demandes spéciales (optionnel)"
          value={specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="Arrivée tardive, étage élevé..."
        />
      </Reveal>

      {roomForBook && nights > 0 ? (
        <Reveal delay={motion.stagger(4)}>
          <View style={styles.recap}>
            <Text style={styles.recapLabel}>
              {roomForBook.name} · {nights} nuit{nights > 1 ? "s" : ""} × {formatXAF(roomForBook.pricePerNight)}
            </Text>
            <Text style={styles.total}>{formatXAF(total)}</Text>
          </View>
        </Reveal>
      ) : null}

      {bookingMutation.isError ? (
        <Text style={styles.error}>{bookingErrorMessage(bookingMutation.error)}</Text>
      ) : null}

      <Reveal delay={motion.stagger(5)}>
        <View style={styles.cta}>
          {bookingMutation.isPending ? (
            <Spinner label="Réservation…" />
          ) : (
            <ActionButton
              label="Confirmer la réservation"
              onPress={submit}
              disabled={!roomForBook || nights < 1 || bookingMutation.isPending}
            />
          )}
        </View>
      </Reveal>
    </ScrollView>
  );
}

function PressableRoom({
  room,
  selected,
  onPress,
}: {
  room: HotelRoom;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={[styles.roomRow, selected && styles.roomRowSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Choisir ${room.name}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.roomMain}>
        <Text style={styles.roomName}>{room.name}</Text>
        <Text style={styles.roomMeta}>
          {room.capacity} pers. · {room.bedType ?? "—"}
        </Text>
        <Text style={styles.roomPrice}>
          {formatXAF(room.pricePerNight)} / nuit
        </Text>
      </View>
      <Text style={[styles.roomBadge, selected && styles.roomBadgeSelected]}>
        {selected ? "Sélectionnée" : "Choisir"}
      </Text>
    </AnimatedPressFeedback>
  );
}

function PressableStep({
  label,
  onPress,
  disabled,
  symbol,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  symbol: string;
}) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      disabled={disabled}
      style={[styles.step, disabled && styles.stepDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.stepText}>{symbol}</Text>
    </AnimatedPressFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  meta: { fontSize: 14, color: colors.ink2, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  muted: { fontSize: 14, color: colors.ink2 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
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
  roomPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.woodDark,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  roomBadge: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roomBadgeSelected: { backgroundColor: colors.ink, color: colors.paper, borderColor: colors.ink },
  recap: {
    marginTop: 24,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  recapLabel: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  total: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, color: "#B3261E", marginTop: 12 },
  cta: { marginTop: 24 },
});
