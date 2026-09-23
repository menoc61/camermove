import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, typography } from "@/constants/theme";

export const ONBOARDED_KEY = "cm-onboarded";

const SLIDES = [
  {
    eyebrow: "01 — Transport",
    title: "Voyagez entre les villes du Cameroun",
    body: "Yaoundé, Douala, Bafoussam et plus — comparez les agences et réservez votre siège.",
  },
  {
    eyebrow: "02 — Services",
    title: "Hôtels, locations, colis et assurance",
    body: "Tous les services CamerMove dans une seule app.",
  },
  {
    eyebrow: "03 — Billets",
    title: "Vos billets QR toujours avec vous",
    body: "Payez par Mobile Money ou carte, présentez votre QR à l'embarquement.",
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 20, stiffness: 300 }),
  }));
  return <Animated.View style={[styles.dot, active && styles.dotActive, style]} />;
}

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    router.replace("/(tabs)");
  }

  const slide = SLIDES[index]!;

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Dot key={s.eyebrow} active={i === index} />
        ))}
      </View>
      <View style={styles.row}>
        {index > 0 ? (
          <Pressable onPress={() => setIndex(index - 1)} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Retour</Text>
          </Pressable>
        ) : (
          <Pressable onPress={finish} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Passer</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => (last ? void finish() : setIndex(index + 1))}
          style={styles.primary}
        >
          <Text style={styles.primaryLabel}>{last ? "Commencer" : "Suivant"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center" },
  eyebrow: {
    fontSize: typography.eyebrow.size,
    fontWeight: typography.eyebrow.weight,
    letterSpacing: typography.eyebrow.size * typography.eyebrow.tracking,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: colors.ink,
    marginBottom: 12,
  },
  body: { fontSize: typography.body.size, color: colors.ink1, marginBottom: 32 },
  dots: { flexDirection: "row", gap: 8, marginBottom: 32 },
  dot: { height: 8, width: 8, backgroundColor: colors.surface3 },
  dotActive: { backgroundColor: colors.woodDark },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ghost: { paddingVertical: 14, paddingHorizontal: 8 },
  ghostLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 2.6, color: colors.ink2 },
  primary: { backgroundColor: colors.ink, paddingVertical: 18, paddingHorizontal: 28 },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.paper,
  },
});
