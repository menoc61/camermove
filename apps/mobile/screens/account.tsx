import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { HeartToggle } from "@/components/ui/heart-toggle";
import { IconButton } from "@/components/ui/icon-button";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonCard, SkeletonList, SkeletonTile } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { StatIndicator } from "@/components/ui/stat-indicator";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/lib/auth/session";
import { fetchMyBookings, type MyBookingItem } from "@/lib/api/bookings";
import { getDashboard } from "@/lib/api/dashboard";
import { fetchFavorites } from "@/lib/api/favorites";
import { fetchMyNotifications } from "@/lib/api/notifications";
import { fetchMyPayments, type MyPaymentItem } from "@/lib/api/payments";
import { formatDate, formatTime, formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

type BookingScope = "upcoming" | "history";

const TOTAL_LABELS: Array<{ key: "trips" | "hotels" | "rentals" | "parcels" | "insurance" | "events"; label: string }> = [
  { key: "trips", label: "Voyages" },
  { key: "hotels", label: "Hôtels" },
  { key: "rentals", label: "Locations" },
  { key: "parcels", label: "Colis" },
  { key: "insurance", label: "Assurance" },
  { key: "events", label: "Événements" },
];

export function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [scope, setScope] = useState<BookingScope>("upcoming");
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(accessToken as string),
    enabled: !!accessToken,
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings", "me", scope],
    queryFn: () => fetchMyBookings(accessToken as string, { scope }),
    enabled: !!accessToken,
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments", "me"],
    queryFn: () => fetchMyPayments(accessToken as string),
    enabled: !!accessToken,
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorites", "me"],
    queryFn: () => fetchFavorites(accessToken as string, 1, 1),
    enabled: !!accessToken,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => fetchMyNotifications(accessToken as string),
    enabled: !!accessToken,
  });

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour voir votre compte."
          actionLabel="Se connecter"
          onAction={() => router.push("/login")}
        />
      </View>
    );
  }

  async function onLogout() {
    if (!armed) {
      setArmed(true);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(false);
    await logout();
    toast("Déconnecté.");
    router.replace("/login");
  }

  if (dashboardQuery.isPending) {
    return (
      <View style={styles.content}>
        <SkeletonTile />
        <View style={{ marginTop: 24 }}><SkeletonList count={4} /></View>
      </View>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger votre compte."
        onRetry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const hero = dashboard.upcoming[0];
  const unread = notificationsQuery.data?.items.filter((n) => !n.read).length ?? 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Reveal>
        <Text style={styles.eyebrow}>CamerMove</Text>
        <Text style={styles.title}>Bonjour</Text>
        {user ? (
          <Text selectable style={styles.email}>
            {user.email}
          </Text>
        ) : null}
      </Reveal>

      {dashboard.totals ? (
        <Reveal delay={motion.stagger(1)}>
          <View style={styles.totals}>
            {TOTAL_LABELS.map((t) => (
              <View key={t.key} style={styles.total}>
                <Text style={styles.totalValue}>{dashboard.totals?.[t.key] ?? 0}</Text>
                <Text style={styles.totalLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
        </Reveal>
      ) : null}

      {hero ? (
        <Reveal delay={motion.stagger(2)}>
          <AnimatedPressFeedback
            onPress={hero.ticketId ? () => router.push(`/tickets/${hero.ticketId}`) : undefined}
            style={styles.hero}
            accessibilityRole="button"
            accessibilityLabel={`Prochain voyage ${hero.origin} vers ${hero.destination}`}
          >
            <Text style={styles.heroEyebrow}>Prochain voyage</Text>
            <Text style={styles.heroRoute}>
              {hero.origin} → {hero.destination}
            </Text>
            <Text style={styles.heroMeta}>
              {formatDate(hero.departureAt)} · {formatTime(hero.departureAt)} · {formatXAF(hero.totalAmount)}
            </Text>
          </AnimatedPressFeedback>
        </Reveal>
      ) : null}

      <Reveal delay={motion.stagger(3)}>
        <Text style={styles.sectionTitle}>Mes réservations</Text>
        <View style={styles.toggle}>
          {(["upcoming", "history"] as BookingScope[]).map((s) => (
            <AnimatedPressFeedback
              key={s}
              onPress={() => setScope(s)}
              style={[styles.toggleButton, scope === s && styles.toggleActive]}
              accessibilityRole="button"
              accessibilityLabel={s === "upcoming" ? "Voyages à venir" : "Historique"}
            >
              <Text style={[styles.toggleText, scope === s && styles.toggleTextActive]}>
                {s === "upcoming" ? "À venir" : "Historique"}
              </Text>
            </AnimatedPressFeedback>
          ))}
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(4)}>
        {bookingsQuery.isPending ? (
          <View style={{ height: 220 }}>
            <SkeletonList count={3} />
          </View>
        ) : bookingsQuery.isError ? (
          <ErrorState
            message="Impossible de charger vos réservations."
            onRetry={() => void bookingsQuery.refetch()}
          />
        ) : bookingsQuery.data.items.length === 0 ? (
          <EmptyState message="Aucune réservation dans cette section." />
        ) : (
          <FlashList
            data={bookingsQuery.data.items as MyBookingItem[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AnimatedPressFeedback
                onPress={item.ticketId ? () => router.push(`/tickets/${item.ticketId}`) : undefined}
                style={styles.card}
              >
                <Text selectable style={styles.cardRef}>
                  {item.reference}
                </Text>
                <Text style={styles.cardRoute}>
                  {item.origin} → {item.destination}
                </Text>
                <Text style={styles.cardMeta}>
                  {formatDate(item.departureAt)} · {formatTime(item.departureAt)} · {formatXAF(item.totalAmount)}
                </Text>
              </AnimatedPressFeedback>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}
      </Reveal>

      <Reveal delay={motion.stagger(5)}>
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Mes paiements</Text>
      </Reveal>
      <Reveal delay={motion.stagger(6)}>
        {paymentsQuery.isPending ? (
          <View style={{ height: 220 }}>
            <SkeletonList count={3} />
          </View>
        ) : paymentsQuery.isError ? (
          <ErrorState
            message="Impossible de charger vos paiements."
            onRetry={() => void paymentsQuery.refetch()}
          />
        ) : paymentsQuery.data.items.length === 0 ? (
          <EmptyState message="Aucun paiement pour le moment." />
        ) : (
          <View style={{ height: Math.min(56 * paymentsQuery.data.items.length + 8, 280) }}>
            <FlashList
              data={paymentsQuery.data.items as MyPaymentItem[]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardRoute}>{formatXAF(item.amount)}</Text>
                  <Text style={styles.cardMeta}>
                    {item.provider}
                    {item.method ? ` · ${item.method}` : ""} · {item.status} · {formatDate(item.createdAt)}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          </View>
        )}
      </Reveal>

      <Reveal delay={motion.stagger(7)}>
        <View style={styles.statRow}>
          <View style={styles.favCell}>
            <HeartToggle
              active={false}
              onToggle={() => router.push("/(tabs)/search" as never)}
              size={32}
              accessibilityLabel="Ajouter aux favoris"
            />
            <StatIndicator
              label="Favoris"
              value={
                favoritesQuery.data
                  ? favoritesQuery.data.total.toString()
                  : "—"
              }
            />
          </View>
          <StatIndicator
            label="Notifications"
            value={unread > 0 ? `${unread} non lues` : "À jour"}
          />
          <StatIndicator
            label="Statut compte"
            value={user?.role ?? "Voyageur"}
          />
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(8)}>
        <View style={styles.logout}>
          <ActionButton
            label={armed ? "Confirmer la déconnexion" : "Se déconnecter"}
            onPress={onLogout}
            variant={armed ? "danger" : "primary"}
          />
          <AnimatedPressFeedback
            onPress={() => router.push("/lookup")}
            accessibilityRole="link"
            style={styles.lookupLink}
          >
            <Text style={styles.lookupLinkLabel}>Vérifier un billet invité</Text>
          </AnimatedPressFeedback>
        </View>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  guard: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  email: { fontSize: 15, color: colors.ink2, marginBottom: 24 },
  totals: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    marginBottom: 16,
  },
  total: { width: "33.333%", paddingVertical: 12, alignItems: "center" },
  totalValue: { fontSize: 17, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  totalLabel: { fontSize: 11, color: colors.ink2, marginTop: 2 },
  hero: {
    backgroundColor: colors.ink,
    padding: 16,
    marginBottom: 24,
    borderRadius: 0,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.woodLight,
    marginBottom: 8,
  },
  heroRoute: { fontSize: 20, fontWeight: "500", color: colors.paper, marginBottom: 4 },
  heroMeta: { fontSize: 14, color: colors.paper, fontVariant: ["tabular-nums"] },
  sectionTitle: { fontSize: 20, fontWeight: "500", color: colors.ink, marginBottom: 12, marginTop: 8 },
  toggle: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  toggleActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  toggleTextActive: { color: colors.paper },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 14,
  },
  cardRef: { fontSize: 13, fontWeight: "500", letterSpacing: 1.2, color: colors.ink, marginBottom: 2 },
  cardRoute: { fontSize: 16, fontWeight: "500", color: colors.ink, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  statRow: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 16, flexWrap: "wrap" },
  favCell: { alignItems: "center", gap: 8, paddingVertical: 8 },
  logout: { marginTop: 16, gap: 12 },
  lookupLink: { paddingVertical: 14, alignItems: "center", minHeight: 44, justifyContent: "center" },
  lookupLinkLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
