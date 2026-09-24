import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { colors, typography } from "@/constants/theme";
import { motion } from "@/lib/motion";

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
    body: "Tous les services CamerMove dans une seule app, avec paiement Mobile Money.",
  },
  {
    eyebrow: "03 — Billets",
    title: "Vos billets QR toujours avec vous",
    body: "Payez par Mobile Money ou carte, présentez votre QR à l'embarquement.",
  },
];

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 24 : 8);
  const activeStyle = useAnimatedStyle(() => ({ width: width.value }));
  // Use derived shared value to avoid setState cascade when active flips.
  width.value = withSpring(active ? 24 : 8, { damping: 20, stiffness: 300 });
  return <Animated.View style={[styles.dot, active && styles.dotActive, activeStyle]} />;
}

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Fail open: re-showing onboarding next launch beats stranding the user.
    }
    router.replace("/(tabs)");
  }

  function next() {
    if (last) {
      void finish();
      return;
    }
    // Crossfade between slides
    opacity.value = withTiming(0, { duration: motion.duration.fast }, () => {
      opacity.value = withTiming(1, { duration: motion.duration.base });
    });
    translateY.value = withTiming(-8, { duration: motion.duration.fast }, () => {
      translateY.value = withTiming(0, { duration: motion.duration.base });
    });
    setIndex(index + 1);
  }

  const slide = SLIDES[index]!;
  const slideStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={slideStyle}>
        <Reveal>
          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Reveal>
      </Animated.View>

      <View style={styles.dots}>
        {SLIDES.map((s) => (
          <Dot key={s.eyebrow} active={s === slide} />
        ))}
      </View>

      <View style={styles.row}>
        {index > 0 ? (
          <AnimatedPressFeedback
            onPress={() => setIndex(index - 1)}
            style={styles.ghost}
            accessibilityRole="button"
            accessibilityLabel="Slide précédent"
          >
            <Text style={styles.ghostLabel}>Retour</Text>
          </AnimatedPressFeedback>
        ) : (
          <AnimatedPressFeedback
            onPress={finish}
            style={styles.ghost}
            accessibilityRole="button"
            accessibilityLabel="Passer l'introduction"
          >
            <Text style={styles.ghostLabel}>Passer</Text>
          </AnimatedPressFeedback>
        )}
        <ActionButton
          label={last ? "Commencer" : "Suivant"}
          onPress={next}
        />
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
  ghost: { paddingVertical: 14, paddingHorizontal: 8, minHeight: 44, justifyContent: "center" },
  ghostLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 2.6, color: colors.ink2 },
});
