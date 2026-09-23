import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { colors } from "@/constants/theme";
import { fetchMyTickets, type MyTicketItem } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/format";

export function ticketStatusLabel(status: string): string {
  if (status === "valid") return "Valide";
  if (status === "used") return "Utilisé";
  if (status === "void") return "Annulé";
  return status;
}

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

  if (ticketsQuery.isPending) return <LoadingState label="Chargement de vos billets…" />;
  if (ticketsQuery.isError) {
    return (
      <ErrorState
        message="Impossible de charger vos billets."
        onRetry={() => void ticketsQuery.refetch()}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CamerMove</Text>
          <Text style={styles.title}>Mes billets</Text>
        </View>
      </View>
      <View style={styles.lookupButton}>
        <Button label="Vérifier un billet" onPress={() => router.push("/tickets/lookup")} />
      </View>
      <FlatList
        data={ticketsQuery.data.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState message="Aucun billet pour le moment." />}
        renderItem={({ item }: { item: MyTicketItem }) => (
          <Pressable
            onPress={() => router.push(`/tickets/${item.id}`)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`Billet ${item.verificationCode} ${item.origin} vers ${item.destination}`}
          >
            <Text style={styles.code} selectable>
              {item.verificationCode}
            </Text>
            <Text style={styles.route}>
              {item.origin} → {item.destination}
            </Text>
            <Text style={styles.meta}>
              {formatDate(item.departureAt)} · {formatTime(item.departureAt)}
            </Text>
            <Text style={styles.status}>{ticketStatusLabel(item.status)}</Text>
          </Pressable>
        )}
      />
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
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 16 },
  lookupButton: { paddingHorizontal: 24, marginBottom: 16 },
  list: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
  },
  code: { fontSize: 14, fontWeight: "500", letterSpacing: 1.2, color: colors.ink, marginBottom: 4 },
  route: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  meta: { fontSize: 13, color: colors.ink2, marginBottom: 8 },
  status: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.woodDark,
  },
});
