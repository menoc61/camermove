import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { colors } from "@/constants/theme";
import { ApiError } from "@/lib/api/resource";
import { lookupTicket } from "@/lib/api/tickets";
import { formatDate, formatTime } from "@/lib/format";

export function lookupStatusLabel(status: string): string {
  if (status === "valid") return "Valide";
  if (status === "used") return "Utilisé";
  if (status === "void") return "Annulé";
  return status;
}

interface LookupResult {
  reference: string;
  origin: string;
  destination: string;
  departureAt: string;
  status: string;
  passengerFirstName?: string | null;
}

export function LookupScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const initialRef = typeof params.ref === "string" ? params.ref : "";
  const [input, setInput] = useState(initialRef);
  const [submitted, setSubmitted] = useState<string | null>(initialRef ? initialRef : null);

  const lookupQuery = useQuery({
    queryKey: ["lookup", submitted],
    queryFn: () => lookupTicket(submitted as string) as Promise<LookupResult>,
    enabled: submitted !== null,
    retry: false,
  });

  function submit() {
    const ref = input.trim();
    if (!ref) return;
    setSubmitted(ref);
  }

  const error = lookupQuery.error;
  const errorMessage =
    error instanceof ApiError && error.status === 404
      ? "Billet introuvable"
      : error instanceof ApiError && error.status === 410
        ? "Ce trajet est expiré"
        : error instanceof Error
          ? error.message
          : "Échec de la vérification.";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Vérifier un billet</Text>
      <Field
        label="Référence du billet"
        value={input}
        onChangeText={setInput}
        placeholder="Ex : CM-ABC123"
        autoCapitalize="characters"
      />
      <Button label="Vérifier" onPress={submit} />

      <View style={styles.result}>
        {submitted === null ? (
          <EmptyState message="Saisissez une référence pour vérifier un billet." />
        ) : lookupQuery.isPending ? (
          <Text style={styles.note}>Vérification en cours…</Text>
        ) : lookupQuery.isError ? (
          <ErrorState message={errorMessage} onRetry={() => void lookupQuery.refetch()} />
        ) : lookupQuery.data ? (
          <View style={styles.card}>
            <Text selectable style={styles.reference}>
              {lookupQuery.data.reference}
            </Text>
            <Text style={styles.route}>
              {lookupQuery.data.origin} → {lookupQuery.data.destination}
            </Text>
            <Text style={styles.meta}>
              {formatDate(lookupQuery.data.departureAt)} · {formatTime(lookupQuery.data.departureAt)}
            </Text>
            <Text style={styles.status}>{lookupStatusLabel(lookupQuery.data.status)}</Text>
            {lookupQuery.data.passengerFirstName ? (
              <Text style={styles.passenger}>Passager : {lookupQuery.data.passengerFirstName}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  result: { marginTop: 24 },
  note: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  card: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 16,
  },
  reference: { fontSize: 14, fontWeight: "500", letterSpacing: 1.2, color: colors.ink, marginBottom: 4 },
  route: { fontSize: 18, fontWeight: "500", color: colors.ink, marginBottom: 4 },
  meta: { fontSize: 13, color: colors.ink2, marginBottom: 8, fontVariant: ["tabular-nums"] },
  status: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.woodDark,
  },
  passenger: { fontSize: 14, color: colors.ink1, marginTop: 8 },
});
