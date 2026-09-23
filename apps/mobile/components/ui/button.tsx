import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/constants/theme";

export function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.root, disabled && styles.disabled]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, paddingVertical: 18, paddingHorizontal: 28, alignItems: "center" },
  disabled: { opacity: 0.4 },
  label: { fontSize: 12, fontWeight: "500", letterSpacing: 2.6, textTransform: "uppercase", color: colors.paper },
});
