import { Host, List, ListItem } from "@expo/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/lib/auth/session";
import { fetchMyBookings } from "@/lib/api/bookings";
import { getDashboard } from "@/lib/api/dashboard";
import { fetchFavorites } from "@/lib/api/favorites";
import { fetchMyNotifications } from "@/lib/api/notifications";
import { fetchMyPayments } from "@/lib/api/payments";
import { formatDate, formatTime, formatXAF } from "@/lib/format";

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

  if (dashboardQuery.isPending) return <LoadingState label="Chargement de votre compte…" />;
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
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Bonjour</Text>
      {user ? (
        <Text selectable style={styles.email}>
          {user.email}
        </Text>
      ) : null}

      {dashboard.totals ? (
        <View style={styles.totals}>
          {TOTAL_LABELS.map((t) => (
            <View key={t.key} style={styles.total}>
              <Text style={styles.totalValue}>{dashboard.totals?.[t.key] ?? 0}</Text>
              <Text style={styles.totalLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hero ? (
        <Pressable
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
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Mes réservations</Text>
      <View style={styles.toggle}>
        {(["upcoming", "history"] as BookingScope[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setScope(s)}
            style={[styles.toggleButton, scope === s && styles.toggleActive]}
            accessibilityRole="button"
            accessibilityLabel={s === "upcoming" ? "Voyages à venir" : "Historique"}
          >
            <Text style={[styles.toggleText, scope === s && styles.toggleTextActive]}>
              {s === "upcoming" ? "À venir" : "Historique"}
            </Text>
          </Pressable>
        ))}
      </View>
      {bookingsQuery.isPending ? (
        <Text style={styles.note}>Chargement des réservations…</Text>
      ) : bookingsQuery.isError ? (
        <ErrorState
          message="Impossible de charger vos réservations."
          onRetry={() => void bookingsQuery.refetch()}
        />
      ) : bookingsQuery.data.items.length === 0 ? (
        <EmptyState message="Aucune réservation dans cette section." />
      ) : (
        bookingsQuery.data.items.map((b) => (
          <Pressable
            key={b.id}
            onPress={b.ticketId ? () => router.push(`/tickets/${b.ticketId}`) : undefined}
            style={styles.card}
          >
            <Text selectable style={styles.cardRef}>
              {b.reference}
            </Text>
            <Text style={styles.cardRoute}>
              {b.origin} → {b.destination}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDate(b.departureAt)} · {formatTime(b.departureAt)} · {formatXAF(b.totalAmount)}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Mes paiements</Text>
      {paymentsQuery.isPending ? (
        <Text style={styles.note}>Chargement des paiements…</Text>
      ) : paymentsQuery.isError ? (
        <ErrorState
          message="Impossible de charger vos paiements."
          onRetry={() => void paymentsQuery.refetch()}
        />
      ) : paymentsQuery.data.items.length === 0 ? (
        <EmptyState message="Aucun paiement pour le moment." />
      ) : (
        paymentsQuery.data.items.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardRoute}>{formatXAF(p.amount)}</Text>
            <Text style={styles.cardMeta}>
              {p.provider}
              {p.method ? ` · ${p.method}` : ""} · {p.status} · {formatDate(p.createdAt)}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Mon compte</Text>
      <Host matchContents>
        <List>
          <ListItem
            supportingText={
              favoritesQuery.data ? `${favoritesQuery.data.total} enregistrement(s)` : "…"
            }
          >
            Mes favoris
          </ListItem>
          <ListItem supportingText={unread > 0 ? `${unread} non lue(s)` : "Tout est lu"}>
            Notifications
          </ListItem>
          <ListItem onPress={() => router.push("/tickets/lookup")}>
            Vérifier un billet
          </ListItem>
        </List>
      </Host>

      <View style={styles.logout}>
        <Button
          label={armed ? "Confirmer la déconnexion" : "Se déconnecter"}
          onPress={onLogout}
        />
      </View>
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
    marginBottom: 8,
  },
  cardRef: { fontSize: 13, fontWeight: "500", letterSpacing: 1.2, color: colors.ink, marginBottom: 2 },
  cardRoute: { fontSize: 16, fontWeight: "500", color: colors.ink, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  note: { fontSize: 14, color: colors.ink2, marginBottom: 8 },
  logout: { marginTop: 24 },
});
