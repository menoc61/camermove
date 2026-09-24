import { useMutation } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { isEmailValid, isPasswordValid } from "@/lib/validation";
import { motion } from "@/lib/motion";

export function RegisterScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/(tabs)";
  const setAuth = useAuthStore((s) => s.setAuth);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      register({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      }),
    onSuccess: (res) => {
      setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken ?? null,
        user: res.user,
      });
      toast("Compte créé.");
      router.replace(next as never);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) toast("Un compte existe déjà avec cet e-mail.");
      else toast(e instanceof Error ? e.message : "Échec de l'inscription.");
    },
  });

  function submit() {
    setSubmitted(true);
    if (!isEmailValid(email)) {
      toast("Adresse e-mail invalide.");
      return;
    }
    if (!isPasswordValid(password)) {
      toast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (confirm !== password) {
      toast("Les mots de passe ne correspondent pas.");
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate();
  }

  const emailError = submitted && !isEmailValid(email) ? "E-mail invalide" : undefined;
  const passwordError =
    submitted && !isPasswordValid(password) ? "Au moins 8 caractères" : undefined;
  const confirmError = submitted && confirm !== password ? "Ne correspond pas" : undefined;

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
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>
            Réservez vos trajets, séjours et événements en un seul endroit.
          </Text>
        </Reveal>

        <Reveal delay={motion.stagger(1)}>
          <Field
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="ex : Amina"
            autoCapitalize="words"
            autoComplete="given-name"
          />
          <Field
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            placeholder="ex : Mbarga"
            autoCapitalize="words"
            autoComplete="family-name"
          />
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.cm"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={emailError}
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            error={passwordError}
          />
          <Field
            label="Confirmer le mot de passe"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            error={confirmError}
          />
        </Reveal>

        <Reveal delay={motion.stagger(2)}>
          {mutation.isPending ? (
            <View style={styles.cta}>
              <Spinner label="Création du compte…" />
            </View>
          ) : (
            <View style={styles.cta}>
              <ActionButton
                label="Créer mon compte"
                onPress={submit}
                disabled={mutation.isPending}
              />
            </View>
          )}

          <Link href="/login" asChild>
            <AnimatedPressFeedback style={styles.footLink}>
              <Text style={styles.footLinkLabel}>Déjà un compte ? Se connecter</Text>
            </AnimatedPressFeedback>
          </Link>
        </Reveal>
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
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: colors.ink1, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  cta: { marginTop: 8 },
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
