import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
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
import { fetchEvent, type Event, type TicketCategory } from "@/lib/api/events";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { motion, useReduceMotion } from "@/lib/motion";

function formatEventDateRange(start: string, end: string | null): string {
  const s = new Date(start);
  if (end) {
    const e = new Date(end);
    return `${s.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return s.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function Hero({ photo, name }: { photo: string | null; name: string }) {
  const opacity = useSharedValue(0);
  const reduced = useReduceMotion();
  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: reduced ? 0 : motion.duration.slow,
    });
  }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.hero, style]} accessibilityLabel={`Affiche de ${name}`}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.heroImage} resizeMode="cover" />
      ) : (
        <View style={[styles.heroImage, styles.heroFallback]}>
          <Text style={styles.heroFallbackLabel}>🎟</Text>
        </View>
      )}
    </Animated.View>
  );
}

export function EventDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : null;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id as string),
    enabled: !!id,
  });

  const selectedCategoryDetail = useMemo<TicketCategory | null>(() => {
    if (!eventQuery.data || !selectedCategory) return null;
    return eventQuery.data.ticketCategories?.find((c) => c.id === selectedCategory) ?? null;
  }, [eventQuery.data, selectedCategory]);

  const total = selectedCategoryDetail && quantity > 0 ? selectedCategoryDetail.price * quantity : 0;

  if (!id) {
    return (
      <EmptyState
        message="Événement introuvable."
        actionLabel="Retour aux événements"
        onAction={() => router.push("/events")}
      />
    );
  }

  if (eventQuery.isPending) {
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

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <ErrorState message="Impossible de charger cet événement." onRetry={() => void eventQuery.refetch()} />
    );
  }

  const event: Event = eventQuery.data;
  const heroPhoto = event.posterUrl ?? null;
  const hasCategories = event.ticketCategories && event.ticketCategories.length > 0;

  function buildBookHref(): string {
    const qs = new URLSearchParams({
      eventId: id as string,
      ...(selectedCategory ? { ticketCategoryId: selectedCategory } : {}),
      quantity: String(quantity),
    });
    return `/events/${id}/book?${qs.toString()}`;
  }

  function reserve() {
    if (!selectedCategory) {
      toast("Choisissez une catégorie.");
      return;
    }
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(buildBookHref())}` as never);
      return;
    }
    router.push(buildBookHref() as never);
  }

  function ctaLabel(): string {
    if (selectedCategory && quantity > 0) return `Réserver — ${formatXAF(total)}`;
    if (!selectedCategory) return "Choisir une catégorie";
    return "Réserver";
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Hero photo={heroPhoto} name={event.name} />

      <View style={styles.body}>
        <Reveal>
          <Text style={styles.eyebrow}>
            {event.city}
            {event.venue ? ` · ${event.venue}` : ""}
          </Text>
          <Text style={styles.title}>{event.name}</Text>
          <Text style={styles.date}>{formatEventDateRange(event.startDate, event.endDate)}</Text>
          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
        </Reveal>

        {event.posterUrl ? null : (
          <Reveal delay={60}>
            <Text style={styles.placeholderLabel}>Aucune affiche disponible</Text>
          </Reveal>
        )}

        <Reveal delay={120}>
          <Text style={styles.sectionTitle}>Catégories de billets</Text>
          {!hasCategories ? (
            <Text style={styles.muted}>Aucune catégorie disponible pour le moment.</Text>
          ) : (
            event.ticketCategories!.map((c, i) => (
              <Reveal key={c.id} delay={140 + i * 50}>
                <CategoryRow
                  category={c}
                  selected={selectedCategory === c.id}
                  onSelect={() => setSelectedCategory(c.id)}
                  onQuantityChange={setQuantity}
                  maxQuantity={c.available}
                />
              </Reveal>
            ))
          )}
        </Reveal>

        <Reveal delay={200}>
          <Text style={styles.sectionTitle}>Réserver</Text>
          <View style={styles.bookBox}>
            {selectedCategoryDetail ? (
              <>
                <Text style={styles.selectedCategory}>
                  {selectedCategoryDetail.name} — {formatXAF(selectedCategoryDetail.price)} × {quantity}
                </Text>
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
                  <Text style={styles.stepValue}>{quantity}</Text>
                  <AnimatedPressFeedback
                    onPress={() => setQuantity((n) => Math.min(selectedCategoryDetail?.available ?? 10, n + 1))}
                    disabled={quantity >= (selectedCategoryDetail?.available ?? 10)}
                    style={[styles.step, quantity >= (selectedCategoryDetail?.available ?? 10) && styles.stepDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Augmenter la quantité"
                  >
                    <Text style={styles.stepText}>+</Text>
                  </AnimatedPressFeedback>
                </View>
                <Text style={styles.recap}>
                  Total: <Text style={styles.recapTotal}>{formatXAF(total)}</Text>
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Sélectionnez une catégorie pour voir le récapitulatif.</Text>
            )}

            <ActionButton
              label={ctaLabel()}
              onPress={reserve}
              disabled={!hasCategories || !selectedCategory || quantity < 1}
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

function CategoryRow({
  category,
  selected,
  onSelect,
  onQuantityChange,
  maxQuantity,
}: {
  category: TicketCategory;
  selected: boolean;
  onSelect: () => void;
  onQuantityChange: (n: number) => void;
  maxQuantity: number;
}) {
  return (
    <View style={[styles.categoryRow, selected && styles.categoryRowSelected]}>
      <View style={styles.categoryMain}>
        <Text style={styles.categoryName}>{category.name}</Text>
        {category.description ? (
          <Text style={styles.categoryDesc} numberOfLines={1}>
            {category.description}
          </Text>
        ) : null}
        <Text style={styles.categoryMeta}>
          {category.available} place{category.available > 1 ? "s" : ""} dispo · max {maxQuantity} par commande
        </Text>
        <Text style={styles.categoryPrice}>
          {formatXAF(category.price)}
        </Text>
      </View>
      <AnimatedPressFeedback
        onPress={onSelect}
        style={[styles.categorySelect, selected && styles.categorySelectActive]}
        accessibilityRole="button"
        accessibilityLabel={selected ? "Catégorie sélectionnée" : "Choisir cette catégorie"}
        accessibilityState={{ selected }}
      >
        <Text style={[styles.categorySelectLabel, selected && styles.categorySelectLabelActive]}>
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
  heroFallbackLabel: { fontSize: 48 },
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
  date: { fontSize: 14, color: colors.ink1, marginBottom: 12, fontVariant: ["tabular-nums"] },
  description: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginBottom: 12 },
  placeholderLabel: { fontSize: 14, color: colors.ink2, textAlign: "center", paddingVertical: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  muted: { fontSize: 14, color: colors.ink2 },
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
  categoryDesc: { fontSize: 13, color: colors.ink2 },
  categoryMeta: { fontSize: 13, color: colors.ink2 },
  categoryPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.woodDark,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  categorySelect: {
    minWidth: 96,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  categorySelectActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  categorySelectLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  categorySelectLabelActive: { color: colors.paper },
  bookBox: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
    gap: 12,
  },
  selectedCategory: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
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