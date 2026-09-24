import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonHero, SkeletonText } from "@/components/ui/skeleton-presets";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createEventBooking, createEventBookingPayment, fetchEvent, type Event, type TicketCategory, type EventBooking } from "@/lib/api/events";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { validatePassenger } from "@/lib/validation";

function bookingErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return "Plus de places disponibles";
  if (e instanceof ApiError && e.status === 429) return "Trop de requêtes";
  if (e instanceof Error && e.message) return e.message;
  return "Échec de la réservation.";
}

export function EventBookScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    id: string;
    eventId?: string;
    ticketCategoryId?: string;
    quantity?: string;
  }>();
  const eventId =
    typeof params.eventId === "string" && params.eventId.length > 0
      ? params.eventId
      : typeof params.id === "string" && params.id.length > 0
        ? params.id
        : null;
  const initialCategoryId = typeof params.ticketCategoryId === "string" ? params.ticketCategoryId : "";
  const initialQuantity = (() => {
    const n = Number(params.quantity);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
  })();

  const accessToken = useAuthStore((s) => s.accessToken);

  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [passengers, setPassengers] = useState<string[]>(() =>
    Array.from({ length: initialQuantity }, () => ""),
  );
  const [created, setCreated] = useState<EventBooking | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!accessToken && eventId) {
      const next = `/events/${eventId}/book?eventId=${encodeURIComponent(eventId)}${
        categoryId ? `&ticketCategoryId=${encodeURIComponent(categoryId)}` : ""
      }&quantity=${quantity}`;
      router.replace(`/login?next=${encodeURIComponent(next)}` as never);
    }
  }, [accessToken, eventId, router, categoryId, quantity]);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId as string),
    enabled: !!eventId,
  });

  const selectedCategory = useMemo<TicketCategory | null>(() => {
    if (!eventQuery.data) return null;
    if (categoryId) {
      return eventQuery.data.ticketCategories?.find((c) => c.id === categoryId) ?? null;
    }
    return eventQuery.data.ticketCategories?.[0] ?? null;
  }, [eventQuery.data, categoryId]);

  const total = selectedCategory && quantity > 0 ? selectedCategory.price * quantity : 0;

  useEffect(() => {
    setPassengers((prev) => {
      if (prev.length === quantity) return prev;
      if (prev.length < quantity) return [...prev, ...Array.from({ length: quantity - prev.length }, () => "")];
      return prev.slice(0, quantity);
    });
  }, [quantity]);

  const bookingMutation = useMutation({
    mutationFn: () =>
      createEventBooking(accessToken as string, {
        eventId: eventId as string,
        ticketCategoryId: (selectedCategory?.id ?? categoryId) as string,
        quantity,
      }),
    onSuccess: (data) => {
      setCreated(data);
      toast("Réservation créée. Procédez au paiement.");
    },
    onError: (e) => {
      toast(bookingErrorMessage(e));
    },
  });

  if (!eventId) {
    return (
      <EmptyState
        message="Événement introuvable."
        actionLabel="Retour aux événements"
        onAction={() => router.push("/events")}
      />
    );
  }

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour réserver cet événement."
          actionLabel="Se connecter"
          onAction={() => router.push("/events")}
        />
      </View>
    );
  }

  if (eventQuery.isPending) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <SkeletonHero />
          <View style={{ marginTop: 16 }}>
            <SkeletonText lines={3} />
          </View>
        </View>
      </View>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <ErrorState message="Impossible de charger cet événement." onRetry={() => void eventQuery.refetch()} />
    );
  }

  const event = eventQuery.data;
  const categoryForBook = selectedCategory ?? event.ticketCategories?.[0];

  function chooseCategory(id: string) {
    setCategoryId(id);
  }

  function submit() {
    setSubmitted(true);
    if (!categoryForBook) {
      toast("Aucune catégorie sélectionnée.");
      return;
    }
    if (quantity < 1) {
      toast("Quantité invalide.");
      return;
    }
    if (bookingMutation.isPending) return;
    bookingMutation.mutate();
  }

  const errors = passengers.map((p) =>
    validatePassenger({ fullName: p, phone: undefined }),
  );
  const hasErrors = errors.some((e) => Object.keys(e).length > 0);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Reveal>
        <Text style={styles.eyebrow}>Réservation</Text>
        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.meta}>
          {event.city}
          {event.venue ? ` · ${event.venue}` : ""}
        </Text>
      </Reveal>

      <Reveal delay={60}>
        <Text style={styles.sectionTitle}>Catégorie</Text>
        {event.ticketCategories?.length === 0 ? (
          <Text style={styles.muted}>Aucune catégorie disponible.</Text>
        ) : (
          event.ticketCategories!.map((c) => (
            <PressableCategory
              key={c.id}
              category={c}
              selected={categoryForBook?.id === c.id}
              onPress={() => chooseCategory(c.id)}
            />
          ))
        )}
      </Reveal>

      <Reveal delay={120}>
        <Text style={styles.sectionTitle}>Quantité</Text>
        <View style={styles.stepper}>
          <AnimatedPressFeedback
            onPress={() => setQuantity((n) => Math.max(1, n - 1))}
            disabled={quantity <= 1}
            style={[styles.step, quantity <= 1 && styles.stepDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Réduire la quantité"
          >
            <Text style={styles.stepText}>−</Text>
          </AnimatedPressFeedback>
          <Text style={styles.count}>
            {quantity} billet{quantity > 1 ? "s" : ""}
          </Text>
          <AnimatedPressFeedback
            onPress={() => setQuantity((n) => Math.min(categoryForBook?.available ?? 10, n + 1))}
            disabled={quantity >= (categoryForBook?.available ?? 10)}
            style={[styles.step, quantity >= (categoryForBook?.available ?? 10) && styles.stepDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Augmenter la quantité"
          >
            <Text style={styles.stepText}>+</Text>
          </AnimatedPressFeedback>
        </View>
      </Reveal>

      <Reveal delay={180}>
        <Text style={styles.sectionTitle}>Participants</Text>
        {passengers.map((p, i) => (
          <View key={i} style={styles.passenger}>
            <Text style={styles.passengerHead}>Participant {i + 1}</Text>
            <Field
              label="Nom complet"
              value={p}
              onChangeText={(t) =>
                setPassengers((prev) => {
                  const a = [...prev];
                  a[i] = t;
                  return a;
                })
              }
              placeholder="ex : Amina Mbarga"
              autoCapitalize="words"
              error={submitted ? errors[i]?.fullName : undefined}
            />
          </View>
        ))}
      </Reveal>

      <Reveal delay={240}>
        {categoryForBook && quantity > 0 ? (
          <View style={styles.recap}>
            <Text style={styles.recapLabel}>
              {categoryForBook.name} × {quantity} = {formatXAF(total)}
            </Text>
            <Text style={styles.total}>{formatXAF(total)}</Text>
          </View>
        ) : null}

        {bookingMutation.isError ? (
          <Text style={styles.error}>{bookingErrorMessage(bookingMutation.error)}</Text>
        ) : null}
      </Reveal>

      {created ? (
        <Reveal delay={60}>
          <View style={styles.created}>
            <Text style={styles.createdLabel}>Réservation {created.ticketNumber} créée.</Text>
            <EventPaymentStep
              bookingId={created.id}
              amount={total}
              onPaid={() => router.push(`/events/confirmation?ref=${encodeURIComponent(created.ticketNumber)}` as never)}
            />
          </View>
        </Reveal>
      ) : (
        <Reveal delay={300}>
          <View style={styles.cta}>
            <ActionButton
              label="Confirmer la réservation"
              onPress={submit}
              disabled={bookingMutation.isPending}
              successLabel="Réservation créée"
            />
          </View>
        </Reveal>
      )}
    </ScrollView>
  );
}

function PressableCategory({
  category,
  selected,
  onPress,
}: {
  category: TicketCategory;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressFeedback
      onPress={onPress}
      style={[styles.categoryRow, selected && styles.categoryRowSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Choisir ${category.name}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.categoryMain}>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryMeta}>
          {category.available} place{category.available > 1 ? "s" : ""} dispo · {formatXAF(category.price)}
        </Text>
      </View>
      <Text style={[styles.categoryBadge, selected && styles.categoryBadgeSelected]}>
        {selected ? "Sélectionnée" : "Choisir"}
      </Text>
    </AnimatedPressFeedback>
  );
}

function EventPaymentStep({
  bookingId,
  amount,
  onPaid,
}: {
  bookingId: string;
  amount: number;
  onPaid: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!accessToken) {
      toast("Connectez-vous pour payer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createEventBookingPayment(bookingId, accessToken, "notchpay");
      const url = res.paymentUrl ?? res.authorizationUrl;
      if (url) {
        await WebBrowser.openAuthSessionAsync(url, "camermove://");
      }
      onPaid();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec du paiement.";
      setError(msg);
      toast(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.paymentStep}>
      <Text style={styles.paymentTitle}>Paiement</Text>
      <Text style={styles.paymentAmount}>{formatXAF(amount)}</Text>
      {error ? <Text style={styles.paymentError}>{error}</Text> : null}
      <ActionButton
        label={busy ? "Paiement…" : "Payer maintenant"}
        onPress={submit}
        disabled={busy}
      />
    </View>
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
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  step: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: 22, color: colors.ink },
  count: { fontSize: 16, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  passenger: { marginTop: 8 },
  passengerHead: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  categoryRow: {
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
  categoryRowSelected: { borderColor: colors.ink },
  categoryMain: { flex: 1, gap: 4 },
  categoryName: { fontSize: 16, fontWeight: "500", color: colors.ink },
  categoryMeta: { fontSize: 13, color: colors.ink2 },
  categoryBadge: {
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
  categoryBadgeSelected: { backgroundColor: colors.ink, color: colors.paper, borderColor: colors.ink },
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
  created: { marginTop: 8, gap: 12 },
  createdLabel: { fontSize: 14, fontWeight: "500", color: colors.ink1, marginBottom: 8 },
  paymentStep: { marginTop: 8, padding: 16, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.line, gap: 12 },
  paymentTitle: { fontSize: 18, fontWeight: "500", color: colors.ink },
  paymentAmount: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  paymentError: { fontSize: 13, color: "#B3261E" },
});