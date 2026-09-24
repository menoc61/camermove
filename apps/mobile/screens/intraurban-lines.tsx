import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonRail } from "@/components/ui/skeleton-presets";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { fetchUrbanLines, type UrbanLine } from "@/lib/api/intraurban";
import { useSearchStore } from "@/lib/stores/search";
import { formatXAF } from "@/lib/format";
import { motion } from "@/lib/motion";

export function IntraurbanLinesScreen() {
  const router = useRouter();
  const setSearch = useSearchStore((s) => s.setSearch);
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["urban-lines"],
    queryFn: () => fetchUrbanLines(),
  });

  const items = (list.data ?? []).filter((line) => {
    if (q.trim() === "") return true;
    const needle = q.trim().toLowerCase();
    return (
      line.origin.toLowerCase().includes(needle) ||
      line.dest.toLowerCase().includes(needle) ||
      line.companyName.toLowerCase().includes(needle)
    );
  });

  function openLine(line: UrbanLine) {
    setSearch({ origin: line.origin, destination: line.dest });
    router.push("/(tabs)/search" as never);
  }

  return (
    <View style={styles.root}>
      <Reveal>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Trajets intra-urbains</Text>
          <Text style={styles.title}>Lignes de la journée</Text>
          <Text style={styles.subtitle}>
            Voyages courts au sein d'une même ville. Sélectionnez une ligne pour
            voir les départs disponibles.
          </Text>
        </View>
      </Reveal>

      <Reveal delay={motion.stagger(1)}>
        <View style={styles.searchWrap}>
          <Field
            label="Rechercher"
            value={q}
            onChangeText={setQ}
            placeholder="Quartier, ville, transporteur..."
            autoCapitalize="words"
          />
        </View>
      </Reveal>

      {list.isPending ? (
        <View style={styles.listWrap}>
          <SkeletonRail count={4} />
        </View>
      ) : list.isError ? (
        <ErrorState
          message="Impossible de charger les lignes intra-urbaines."
          onRetry={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState message="Aucune ligne ne correspond à votre recherche." />
      ) : (
        <View style={styles.listWrap}>
          <FlashList
            data={items as UrbanLine[]}
            keyExtractor={(item) => `${item.origin}->${item.dest}-${item.transporterId}`}
            renderItem={({ item, index }) => (
              <Reveal delay={motion.stagger(Math.min(index, 4))}>
                <AnimatedPressFeedback
                  onPress={() => openLine(item)}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Ligne ${item.origin} vers ${item.dest}`}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEyebrow}>{item.companyName}</Text>
                    <Text style={styles.tripsToday}>
                      {item.tripCountToday} dép. auj.
                    </Text>
                  </View>
                  <Text style={styles.route}>
                    {item.origin} → {item.dest}
                  </Text>
                  <Text style={styles.price}>
                    dès {formatXAF(item.price)}
                  </Text>
                </AnimatedPressFeedback>
              </Reveal>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: colors.ink1, lineHeight: 20 },
  searchWrap: { paddingHorizontal: 24, paddingVertical: 16 },
  listWrap: { paddingHorizontal: 24, flex: 1 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  tripsToday: { fontSize: 11, color: colors.woodDark, letterSpacing: 1.4, fontWeight: "500" },
  route: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 6 },
  price: { fontSize: 16, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
});
