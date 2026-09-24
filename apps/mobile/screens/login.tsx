import { useMutation } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { motion } from "@/lib/motion";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ next?: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const redirectedRef = useRef(false);

  const next = typeof params.next === "string" && params.next.length > 0 ? params.next : null;

  useEffect(() => {
    if (accessToken && !redirectedRef.current) {
      redirectedRef.current = true;
      if (next && next.startsWith("/")) {
        router.replace(next as never);
      } else {
        router.replace("/(tabs)" as never);
      }
    }
  }, [accessToken, next, router]);

  const mutation = useMutation({
    mutationFn: () => login(normalizeEmail(email), password),
    onSuccess: (session) => {
      setAuth({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        user: session.user,
      });
      if (next && next.startsWith("/")) {
        router.replace(next as never);
      } else {
        router.replace("/(tabs)" as never);
      }
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.status === 401
          ? "Identifiants incorrects."
          : e instanceof Error
            ? e.message
            : "Échec de connexion.";
      toast(msg);
    },
  });

  function submit() {
    setSubmitted(true);
    if (!EMAIL_RE.test(normalizeEmail(email))) {
      toast("Saisissez une adresse e-mail valide.");
      return;
    }
    if (password.length < 6) {
      toast("Mot de passe trop court (6 caractères min).");
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate();
  }

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
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Accédez à vos billets, vos hôtels et vos colis depuis n'importe où.
          </Text>
        </Reveal>

        <Reveal delay={motion.stagger(1)}>
          <Field
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.cm"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={submitted && !EMAIL_RE.test(normalizeEmail(email)) ? "E-mail invalide" : undefined}
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            error={submitted && password.length < 6 ? "6 caractères minimum" : undefined}
          />
        </Reveal>

        <Reveal delay={motion.stagger(2)}>
          {mutation.isPending ? (
            <View style={styles.cta}>
              <Spinner label="Connexion…" />
            </View>
          ) : (
            <View style={styles.cta}>
              <ActionButton
                label="Se connecter"
                onPress={submit}
                disabled={mutation.isPending}
              />
            </View>
          )}

          <View style={styles.foot}>
            <Link href="/register" asChild>
              <AnimatedPressFeedback style={styles.footLink}>
                <Text style={styles.footLinkLabel}>Créer un compte</Text>
              </AnimatedPressFeedback>
            </Link>
            <Link href="/lookup" asChild>
              <AnimatedPressFeedback style={styles.footLink}>
                <Text style={styles.footLinkLabel}>Tickets invités</Text>
              </AnimatedPressFeedback>
            </Link>
          </View>
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
  foot: { marginTop: 24, flexDirection: "row", gap: 16, justifyContent: "space-between" },
  footLink: { paddingVertical: 12, paddingHorizontal: 8, minHeight: 44, justifyContent: "center" },
  footLinkLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
