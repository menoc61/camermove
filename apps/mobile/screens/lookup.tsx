import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Link } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { lookupTicket, type TicketLookupResponse } from "@/lib/api/tickets";
import { motion } from "@/lib/motion";

export function LookupScreen() {
  const router = useRouter();
  const toast = useToast();
  const [ref, setRef] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => lookupTicket(ref.trim().toUpperCase()),
    onSuccess: (data) => {
      // Public lookup only returns redacted fields; route to ticket lookup result view.
      toast(`Billet ${data.reference} — ${data.status}`);
      router.push(`/lookup?ref=${encodeURIComponent(data.reference)}` as never);
    },
  });

  function submit() {
    setSubmitted(true);
    if (!ref.trim()) {
      toast("Saisissez votre référence (CM-XXXXXXXX).");
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate();
  }

  const result: TicketLookupResponse | null = mutation.data ?? null;
  const refError = submitted && !ref.trim() ? "Référence requise" : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Reveal>
          <Text style={styles.eyebrow}>CamerMove</Text>
          <Text style={styles.title}>Retrouver une réservation</Text>
          <Text style={styles.subtitle}>
            Saisissez la référence reçue lors de la réservation pour consulter
            votre billet.
          </Text>
        </Reveal>

        <Reveal delay={motion.stagger(1)}>
          <Field
            label="Référence (CM-XXXXXXXX)"
            value={ref}
            onChangeText={(v) => setRef(v.toUpperCase())}
            placeholder="CM-7H3K9ABC"
            autoCapitalize="characters"
            autoCorrect={false}
            error={refError}
          />
        </Reveal>

        <Reveal delay={motion.stagger(2)}>
          {mutation.isPending ? (
            <View style={styles.cta}>
              <Spinner label="Recherche…" />
            </View>
          ) : (
            <View style={styles.cta}>
              <ActionButton
                label="Retrouver mon billet"
                onPress={submit}
                disabled={mutation.isPending}
              />
            </View>
          )}

          {mutation.isError ? (
            <View style={styles.errorBlock}>
              <ErrorState
                message={
                  mutation.error instanceof Error
                    ? mutation.error.message
                    : "Billet introuvable."
                }
                onRetry={() => mutation.mutate()}
              />
            </View>
          ) : null}

          {result ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Billet confirmé</Text>
              <Text style={styles.successMeta}>{result.reference}</Text>
              <Text style={styles.successRoute}>
                {result.tripOrigin} → {result.tripDestination}
              </Text>
              {result.passengerFirstName ? (
                <Text style={styles.successMeta}>
                  Passager: {result.passengerFirstName}
                </Text>
              ) : null}
              <Text style={styles.successStatus}>Statut : {result.status}</Text>
            </View>
          ) : null}

          <Link href="/login" asChild>
            <AnimatedPressFeedback style={styles.footLink}>
              <Text style={styles.footLinkLabel}>Se connecter à mon compte</Text>
            </AnimatedPressFeedback>
          </Link>
        </Reveal>

        {!submitted && !result && !mutation.isError ? (
          <Reveal delay={motion.stagger(3)}>
            <EmptyState message="Aucune référence saisie pour le moment." />
          </Reveal>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48, gap: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  cta: { marginTop: 8 },
  errorBlock: { marginTop: 16 },
  successCard: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    gap: 4,
  },
  successTitle: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.woodDark,
  },
  successMeta: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  successRoute: { fontSize: 18, fontWeight: "500", color: colors.ink },
  successStatus: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 6,
  },
  footLink: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  footLinkLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
