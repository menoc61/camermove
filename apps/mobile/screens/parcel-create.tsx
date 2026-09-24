import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, ErrorState } from "@/components/ui/screen-state";
import { Reveal } from "@/components/ui/reveal";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createParcel, type CreateParcelBody } from "@/lib/api/parcels";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { isPhoneValid } from "@/lib/validation";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";

const PARCEL_TYPES = [
  { value: "document", label: "Document" },
  { value: "package", label: "Colis standard" },
  { value: "fragile", label: "Fragile" },
];

export function ParcelCreateScreen() {
  const router = useRouter();
  const toast = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [senderCity, setSenderCity] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [parcelType, setParcelType] = useState("document");
  const [weightKg, setWeightKg] = useState("");
  const [dimensionsCm, setDimensionsCm] = useState("");
  const [description, setDescription] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<{ trackingNumber: string; id: string } | null>(null);

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour créer un envoi."
          actionLabel="Se connecter"
          onAction={() => router.push("/login")}
        />
      </View>
    );
  }

  const errors = validateForm();

  const mutation = useMutation({
    mutationFn: (body: CreateParcelBody) => createParcel(accessToken, body),
    onSuccess: (data: { trackingNumber: string; id: string }) => {
      setCreated(data);
      toast("Envoi créé.");
    },
    onError: (e: Error) => {
      toast(e.message ?? "Échec de la création.");
    },
  });

  function validateForm() {
    const errs: Record<string, string> = {};
    if (!senderName.trim()) errs.senderName = "Nom requis";
    if (!senderPhone.trim()) errs.senderPhone = "Téléphone requis";
    else if (!isPhoneValid(senderPhone)) errs.senderPhone = "Téléphone invalide (ex: +2376XXXXXXXX)";
    if (!recipientName.trim()) errs.recipientName = "Nom requis";
    if (!recipientPhone.trim()) errs.recipientPhone = "Téléphone requis";
    else if (!isPhoneValid(recipientPhone)) errs.recipientPhone = "Téléphone invalide (ex: +2376XXXXXXXX)";
    if (!senderCity.trim()) errs.senderCity = "Ville requise";
    if (!recipientCity.trim()) errs.recipientCity = "Ville requise";
    return errs;
  }

  function submit() {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      toast("Vérifiez les champs en erreur.");
      return;
    }
    mutation.mutate({
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      senderCity: senderCity.trim(),
      recipientCity: recipientCity.trim(),
      parcelType,
      weightKg: weightKg ? Number(weightKg) : undefined,
      dimensionsCm: dimensionsCm || undefined,
      description: description || undefined,
      declaredValue: declaredValue ? Number(declaredValue) : undefined,
    });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Reveal>
        <Text style={styles.eyebrow}>Nouvel envoi</Text>
        <Text style={styles.title}>Créer un colis</Text>
      </Reveal>

      <Reveal delay={60}>
        <Text style={styles.sectionTitle}>Expéditeur</Text>
        <Field
          label="Nom complet"
          value={senderName}
          onChangeText={setSenderName}
          placeholder="ex : Jean Mbarga"
          autoCapitalize="words"
          error={submitted ? errors.senderName : undefined}
        />
        <Field
          label="Téléphone"
          value={senderPhone}
          onChangeText={setSenderPhone}
          placeholder="+2376XXXXXXXX"
          keyboardType="phone-pad"
          error={submitted ? errors.senderPhone : undefined}
        />
        <Field
          label="Ville"
          value={senderCity}
          onChangeText={setSenderCity}
          placeholder="ex : Yaoundé"
          autoCapitalize="words"
          error={submitted ? errors.senderCity : undefined}
        />
      </Reveal>

      <Reveal delay={120}>
        <Text style={styles.sectionTitle}>Destinataire</Text>
        <Field
          label="Nom complet"
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="ex : Amina Njoya"
          autoCapitalize="words"
          error={submitted ? errors.recipientName : undefined}
        />
        <Field
          label="Téléphone"
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          placeholder="+2376XXXXXXXX"
          keyboardType="phone-pad"
          error={submitted ? errors.recipientPhone : undefined}
        />
        <Field
          label="Ville"
          value={recipientCity}
          onChangeText={setRecipientCity}
          placeholder="ex : Douala"
          autoCapitalize="words"
          error={submitted ? errors.recipientCity : undefined}
        />
      </Reveal>

      <Reveal delay={180}>
        <Text style={styles.sectionTitle}>Colis</Text>
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.parcelTypeRow}>
          {PARCEL_TYPES.map((opt) => (
            <AnimatedPressFeedback
              key={opt.value}
              onPress={() => setParcelType(opt.value)}
              style={[styles.parcelTypeChip, parcelType === opt.value && styles.parcelTypeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: parcelType === opt.value }}
              accessibilityLabel={`Type : ${opt.label}`}
            >
              <Text style={[styles.parcelTypeChipText, parcelType === opt.value && styles.parcelTypeChipTextActive]}>
                {opt.label}
              </Text>
            </AnimatedPressFeedback>
          ))}
        </View>
        <Field
          label="Poids (kg, optionnel)"
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="ex : 2.5"
          keyboardType="decimal-pad"
        />
        <Field
          label="Dimensions L×l×h (cm, optionnel)"
          value={dimensionsCm}
          onChangeText={setDimensionsCm}
          placeholder="ex : 30×20×15"
        />
        <Field
          label="Description (optionnel)"
          value={description}
          onChangeText={setDescription}
          placeholder="ex : Documents administratifs"
          autoCapitalize="words"
        />
        <Field
          label="Valeur déclarée FCFA (optionnel)"
          value={declaredValue}
          onChangeText={setDeclaredValue}
          placeholder="ex : 50000"
          keyboardType="numeric"
        />
      </Reveal>

      <Reveal delay={240}>
        {mutation.isError ? <Text style={styles.error}>{mutation.error?.message ?? "Erreur"}</Text> : null}
      </Reveal>

      {created ? (
        <Reveal delay={60}>
          <View style={styles.created}>
            <Text style={styles.createdLabel}>Envoi {created.trackingNumber} créé.</Text>
            <ActionButton
              label="Voir le suivi"
              onPress={() => router.push(`/parcels/${encodeURIComponent(created.id)}` as never)}
              successLabel="Ouverture…"
            />
          </View>
        </Reveal>
      ) : (
        <Reveal delay={300}>
          <View style={styles.cta}>
            <ActionButton
              label={mutation.isPending ? "Création…" : "Créer l'envoi"}
              onPress={submit}
              disabled={mutation.isPending}
              successLabel="Envoi créé"
            />
          </View>
        </Reveal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  guard: { flex: 1, backgroundColor: colors.paper },
  eyebrow: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 8,
    marginTop: 8,
  },
  parcelTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  parcelTypeChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  parcelTypeChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  parcelTypeChipText: { fontSize: 13, color: colors.ink },
  parcelTypeChipTextActive: { color: colors.paper },
  error: { fontSize: 13, color: "#B3261E", marginTop: 12 },
  cta: { marginTop: 24 },
  created: { marginTop: 8, gap: 12 },
  createdLabel: { fontSize: 14, fontWeight: "500", color: colors.ink1, marginBottom: 8 },
});