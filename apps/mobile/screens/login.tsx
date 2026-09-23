import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/session";
import { isEmailValid, isPasswordValid } from "@/lib/validation";
import { ApiError } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/text-input";
import { GoogleButton } from "@/components/auth/google-button";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";

export function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/(tabs)";
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailError = touched && email.length > 0 && !isEmailValid(email) ? "Adresse e-mail invalide." : undefined;

  async function submit() {
    setTouched(true);
    if (!isEmailValid(email)) {
      toast("Adresse e-mail invalide.");
      return;
    }
    if (!isPasswordValid(password)) {
      toast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const res = await login(email.trim(), password);
      setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
      toast("Connecté.");
      router.replace(next as never);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) toast("E-mail ou mot de passe incorrect.");
      else toast(e instanceof Error ? e.message : "Échec de la connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Connexion</Text>
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" error={emailError} />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Button label={busy ? "Connexion…" : "Se connecter"} onPress={submit} disabled={busy} />
      <View style={styles.gap} />
      <GoogleButton
        onTokens={(t) => {
          setAuth({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user });
          toast("Connecté avec Google.");
          router.replace(next as never);
        }}
        onError={toast}
      />
      <Text style={styles.switch} onPress={() => router.push(`/register${params.next ? `?next=${encodeURIComponent(params.next)}` : ""}` as never)}>
        Pas de compte ? Créer un compte
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 2.4, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  gap: { height: 12 },
  switch: { marginTop: 24, fontSize: 14, color: colors.woodDark, textAlign: "center" },
});
