import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { register } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/session";
import { isEmailValid, isPasswordValid } from "@/lib/validation";
import { ApiError } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";

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
  const [busy, setBusy] = useState(false);

  async function submit() {
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
    setBusy(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
      toast("Compte créé.");
      router.replace(next as never);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast("Un compte existe déjà avec cet e-mail.");
      else toast(e instanceof Error ? e.message : "Échec de l'inscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Créer un compte</Text>
      <Field label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <Field label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <Button label={busy ? "Création…" : "Créer mon compte"} onPress={submit} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 2.4, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
});
