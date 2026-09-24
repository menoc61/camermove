import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { colors } from "@/constants/theme";
import { fetchMyTickets, type MyTicketItem } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/format";
import { motion } from "@/lib/motion";

export function ticketStatusLabel(status: string): string {
  if (status === "valid") return "Valide";
  if (status === "used") return "Utilisé";
  if (status === "void") return "Annulé";
  return status;
}

const STATUS_TINT: Record<string, string> = {
  valid: colors.woodDark,
  used: colors.ink2,
  void: "#B3261E",
};

export function TicketsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "me"],
    queryFn: () => fetchMyTickets(accessToken as string),
    enabled: !!accessToken,
  });

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour voir vos billets."
          actionLabel="Se connecter"
          onAction={() => router.push("/login")}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CamerMove</Text>
            <Text style={styles.title}>Mes billets</Text>
            <Text style={styles.subtitle}>
              Présentez votre code à l'embarquement. Les billets annulés restent
              consultables.
            </Text>
          </View>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <View style={styles.lookupButton}>
          <ActionButton
            label="Vérifier un billet"
            onPress={() => router.push("/lookup")}
            variant="ghost"
          />
        </View>
      </Reveal>

      <View style={styles.listWrap}>
        {ticketsQuery.isPending ? (
          <SkeletonList count={5} />
        ) : ticketsQuery.isError ? (
          <ErrorState
            message="Impossible de charger vos billets."
            onRetry={() => void ticketsQuery.refetch()}
          />
        ) : (ticketsQuery.data?.items ?? []).length === 0 ? (
          <EmptyState
            message="Aucun billet pour le moment."
            actionLabel="Rechercher un trajet"
            onAction={() => router.push("/(tabs)/search")}
          />
        ) : (
          <FlashList
            data={ticketsQuery.data!.items as MyTicketItem[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <AnimatedPressFeedback
                onPress={() => router.push(`/tickets/${item.id}`)}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`Billet ${item.verificationCode} ${item.origin} vers ${item.destination}`}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.code} selectable>
                    {item.verificationCode}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      { color: STATUS_TINT[item.status] ?? colors.woodDark },
                    ]}
                  >
                    {ticketStatusLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.route}>
                  {item.origin} → {item.destination}
                </Text>
                <Text style={styles.meta}>
                  {formatDate(item.departureAt)} · {formatTime(item.departureAt)}
                </Text>
              </AnimatedPressFeedback>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  guard: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 24, paddingTop: 24 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginBottom: 16 },
  lookupButton: { paddingHorizontal: 24, marginBottom: 16 },
  listWrap: { flex: 1, paddingHorizontal: 24 },
  list: { paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { fontSize: 14, fontWeight: "500", letterSpacing: 1.2, color: colors.ink },
  status: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  route: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  meta: { fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
});
