import SegmentedControl from "@expo/ui/community/segmented-control";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createTripPayment } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";
import { isPhoneValid } from "@/lib/validation";

const PROVIDERS = ["notchpay", "cinetpay"] as const;
const PROVIDER_LABELS = ["NotchPay", "CinetPay"];
const METHODS = ["mobile_money", "card"] as const;
const METHOD_LABELS = ["Mobile Money", "Carte"];

type Provider = (typeof PROVIDERS)[number];
type Method = (typeof METHODS)[number];

function paymentErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return "Plus de places disponibles";
  if (e instanceof ApiError && e.status === 429) return "Trop de requêtes";
  if (e instanceof Error && e.message) return e.message;
  return "Échec du paiement.";
}

export function PaymentStep({
  bookingId,
  amount,
  onPaid,
}: {
  bookingId: string;
  amount: number;
  onPaid: () => void;
}) {
  const toast = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [providerIdx, setProviderIdx] = useState(0);
  const [methodIdx, setMethodIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider: Provider = PROVIDERS[providerIdx] ?? "notchpay";
  const method: Method = METHODS[methodIdx] ?? "mobile_money";
  const needsPhone = method === "mobile_money";
  const phoneError =
    needsPhone && (phoneTouched || phone.length > 0) && !isPhoneValid(phone)
      ? "Téléphone invalide (E.164, ex: +2376XXXXXXXX)"
      : undefined;

  async function submit() {
    if (!accessToken) {
      toast("Connectez-vous pour payer.");
      return;
    }
    if (needsPhone) {
      setPhoneTouched(true);
      if (!isPhoneValid(phone)) {
        toast("Téléphone invalide (E.164, ex: +2376XXXXXXXX)");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createTripPayment(accessToken, bookingId, {
        provider,
        method,
        phone: needsPhone ? phone.trim() : undefined,
      });
      const url = res.paymentUrl ?? res.authorizationUrl;
      if (url) {
        await WebBrowser.openAuthSessionAsync(url, "camermove://");
      }
      onPaid();
    } catch (e) {
      const msg = paymentErrorMessage(e);
      setError(msg);
      toast(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>Paiement</Text>
      <Text style={styles.amount}>{formatXAF(amount)}</Text>

      <Text style={styles.label}>Fournisseur</Text>
      <SegmentedControl
        values={[...PROVIDER_LABELS]}
        selectedIndex={providerIdx}
        onValueChange={(value) => {
          const i = PROVIDER_LABELS.indexOf(value);
          if (i >= 0) setProviderIdx(i);
        }}
        onChange={(event) => {
          const i = event.nativeEvent.selectedSegmentIndex;
          if (i >= 0 && i < PROVIDERS.length) setProviderIdx(i);
        }}
      />

      <Text style={styles.label}>Mode de paiement</Text>
      <SegmentedControl
        values={[...METHOD_LABELS]}
        selectedIndex={methodIdx}
        onValueChange={(value) => {
          const i = METHOD_LABELS.indexOf(value);
          if (i >= 0) setMethodIdx(i);
        }}
        onChange={(event) => {
          const i = event.nativeEvent.selectedSegmentIndex;
          if (i >= 0 && i < METHODS.length) setMethodIdx(i);
        }}
      />

      {needsPhone ? (
        <Field
          label="Téléphone Mobile Money"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setError(null);
          }}
          placeholder="+2376XXXXXXXX"
          keyboardType="phone-pad"
          error={phoneError ?? undefined}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? "Paiement…" : "Payer maintenant"} onPress={submit} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 24, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink },
  amount: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  label: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.ink2,
    marginTop: 8,
  },
  error: { fontSize: 13, color: "#B3261E" },
});
