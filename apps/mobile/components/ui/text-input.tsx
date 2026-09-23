import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors } from "@/constants/theme";

export function Field({ label, error, ...props }: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.ink2}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "500", letterSpacing: 2.6, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.ink, borderRadius: 0 },
  inputError: { borderColor: "#B3261E" },
  error: { fontSize: 13, color: "#B3261E", marginTop: 6 },
});
