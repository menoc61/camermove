import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/screen-state";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";
import { createRentalBooking } from "@/lib/api/rentals";
import { fetchRental } from "@/lib/api/rentals";
import { ApiError } from "@/lib/api/resource";
import { useAuthStore } from "@/lib/auth/session";
import { formatXAF } from "@/lib/format";

function calcDuration(start: string, end: string, unit: string): number {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  const ms = b - a;
  if (ms <= 0) return 0;
  if (unit === "hour") return Math.ceil(ms / 3600000);
  if (unit === "week") return Math.ceil(ms / (86400000 * 7));
  if (unit === "month") return Math.ceil(ms / (86400000 * 30));
  return Math.ceil(ms / 86400000);
}

function firstString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function bookingErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return "Véhicule indisponible pour ces dates.";
  if (e instanceof ApiError && e.status === 429) return "Trop de requêtes";
  if (e instanceof Error && e.message) return e.message;
  return "Échec de la réservation.";
}

export function RentalBookScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    id: string;
    startDate?: string;
    endDate?: string;
    pickupCity?: string;
    pickupAddress?: string;
    dropoffCity?: string;
    dropoffAddress?: string;
    driverName?: string;
    driverPhone?: string;
  }>();
  const vehicleId = typeof params.id === "string" && params.id.length > 0 ? params.id : null;

  const accessToken = useAuthStore((s) => s.accessToken);

  const [startDate, setStartDate] = useState(firstString(params.startDate));
  const [endDate, setEndDate] = useState(firstString(params.endDate));
  const [pickupCity, setPickupCity] = useState(firstString(params.pickupCity));
  const [pickupAddress, setPickupAddress] = useState(firstString(params.pickupAddress));
  const [dropoffCity, setDropoffCity] = useState(firstString(params.dropoffCity));
  const [dropoffAddress, setDropoffAddress] = useState(firstString(params.dropoffAddress));
  const [driverName, setDriverName] = useState(firstString(params.driverName));
  const [driverPhone, setDriverPhone] = useState(firstString(params.driverPhone));
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!accessToken && vehicleId) {
      router.replace(`/login?next=${encodeURIComponent(`/rentals/${vehicleId}/book`)}` as never);
    }
  }, [accessToken, vehicleId, router]);

  const query = useQuery({
    queryKey: ["rental", vehicleId],
    queryFn: () => fetchRental(vehicleId as string),
    enabled: !!vehicleId,
  });

  const duration = useMemo(() => calcDuration(startDate, endDate, query.data?.durationUnit ?? "day"), [
    startDate,
    endDate,
    query.data,
  ]);
  const total = query.data && duration > 0 ? query.data.pricePerUnit * duration : 0;

  const mutation = useMutation({
    mutationFn: () =>
      createRentalBooking(accessToken as string, {
        rentalVehicleId: vehicleId as string,
        startDate,
        endDate,
        pickupCity: pickupCity.trim(),
        pickupAddress: pickupAddress.trim() === "" ? undefined : pickupAddress.trim(),
        dropoffCity: dropoffCity.trim() === "" ? pickupCity.trim() : dropoffCity.trim(),
        dropoffAddress: dropoffAddress.trim() === "" ? undefined : dropoffAddress.trim(),
        driverName: driverName.trim() === "" ? undefined : driverName.trim(),
        driverPhone: driverPhone.trim() === "" ? undefined : driverPhone.trim(),
      }),
    onSuccess: (data) => {
      setCreatedId(data.id);
      toast("Réservation créée.");
    },
    onError: (e) => {
      toast(bookingErrorMessage(e));
    },
  });

  if (!vehicleId) {
    return (
      <EmptyState
        message="Véhicule introuvable."
        actionLabel="Voir la liste"
        onAction={() => router.push("/rentals")}
      />
    );
  }

  if (!accessToken) {
    return (
      <View style={styles.guard}>
        <EmptyState
          message="Connectez-vous pour réserver ce véhicule."
          actionLabel="Se connecter"
          onAction={() =>
            router.push(`/login?next=${encodeURIComponent(`/rentals/${vehicleId}/book`)}` as never)
          }
        />
      </View>
    );
  }

  if (query.isPending) {
    return <LoadingState label="Chargement du véhicule…" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Impossible de charger ce véhicule."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const vehicle = query.data;
  const datesValid = startDate !== "" && endDate !== "" && duration >= 1;
  const pickupValid = pickupCity.trim() !== "";
  const canSubmit = datesValid && pickupValid && !mutation.isPending;

  function submit() {
    setSubmitted(true);
    if (!canSubmit) {
      if (!datesValid) toast("Dates invalides.");
      else if (!pickupValid) toast("Ville de retrait requise.");
      return;
    }
    mutation.mutate();
  }

  function gotoConfirmation() {
    if (!createdId) return;
    router.replace(`/rentals/confirmation?id=${encodeURIComponent(createdId)}` as never);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.eyebrow}>Réservation</Text>
      <Text style={styles.title}>
        {vehicle.make} {vehicle.model}
      </Text>
      <Text style={styles.meta}>
        {vehicle.pickupCity} · {vehicle.capacity} places
        {vehicle.hasDriver ? " · avec chauffeur" : ""}
      </Text>

      <Text style={styles.sectionTitle}>Dates</Text>
      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Field
            label="Début"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="AAAA-MM-JJ"
            keyboardType="numeric"
            error={submitted && startDate === "" ? "Date requise" : undefined}
          />
        </View>
        <View style={styles.dateCol}>
          <Field
            label="Fin"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="AAAA-MM-JJ"
            keyboardType="numeric"
            error={submitted && (endDate === "" || duration < 1) ? "Date invalide" : undefined}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Retrait & restitution</Text>
      <Field
        label="Ville retrait"
        value={pickupCity}
        onChangeText={setPickupCity}
        placeholder={vehicle.pickupCity}
        autoCapitalize="words"
        error={submitted && !pickupValid ? "Ville requise" : undefined}
      />
      <Field
        label="Adresse retrait (optionnel)"
        value={pickupAddress}
        onChangeText={setPickupAddress}
        placeholder="ex : Akwa, boulevard de la liberté"
        autoCapitalize="words"
      />
      <Field
        label="Ville restitution"
        value={dropoffCity}
        onChangeText={setDropoffCity}
        placeholder={pickupCity.trim() || vehicle.pickupCity}
        autoCapitalize="words"
      />
      <Field
        label="Adresse restitution (optionnel)"
        value={dropoffAddress}
        onChangeText={setDropoffAddress}
        placeholder="ex : Bonapriso, rue…"
        autoCapitalize="words"
      />

      {vehicle.hasDriver ? (
        <>
          <Text style={styles.sectionTitle}>Chauffeur</Text>
          <Field
            label="Nom chauffeur"
            value={driverName}
            onChangeText={setDriverName}
            placeholder="ex : Jean Mbarga"
            autoCapitalize="words"
          />
          <Field
            label="Téléphone chauffeur"
            value={driverPhone}
            onChangeText={setDriverPhone}
            placeholder="+2376XXXXXXXX"
            keyboardType="phone-pad"
          />
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Récapitulatif</Text>
      <View style={styles.recap}>
        <Text style={styles.recapRow}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={styles.recapRow}>
          {startDate || "—"} → {endDate || "—"} ({duration > 0 ? duration : 0} {vehicle.durationUnit}(s))
        </Text>
        <Text style={styles.recapRow}>Retrait : {pickupCity.trim() || "—"}</Text>
        <View style={styles.recapDivider} />
        <View style={styles.recapTotalRow}>
          <Text style={styles.recapTotalLabel}>Total</Text>
          <Text style={styles.recapTotal}>{total > 0 ? formatXAF(total) : "—"}</Text>
        </View>
      </View>

      {mutation.isError ? <Text style={styles.error}>{bookingErrorMessage(mutation.error)}</Text> : null}

      {createdId ? (
        <View style={styles.created}>
          <Text style={styles.createdLabel}>Réservation #{createdId.slice(0, 8)} créée.</Text>
          <View style={styles.cta}>
            <Button label="Voir la confirmation" onPress={gotoConfirmation} />
          </View>
        </View>
      ) : (
        <View style={styles.cta}>
          <Button
            label={mutation.isPending ? "Réservation…" : "Confirmer la réservation"}
            onPress={submit}
            disabled={mutation.isPending}
          />
        </View>
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
  title: { fontSize: 24, fontWeight: "500", color: colors.ink },
  meta: { fontSize: 14, color: colors.ink1, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 24, marginBottom: 12 },
  dateRow: { flexDirection: "row", gap: 12 },
  dateCol: { flex: 1 },
  recap: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  recapRow: { fontSize: 14, color: colors.ink1, fontVariant: ["tabular-nums"] },
  recapDivider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  recapTotalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  recapTotalLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 2.4, textTransform: "uppercase", color: colors.ink2 },
  recapTotal: { fontSize: 24, fontWeight: "500", color: colors.woodDark, fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, color: "#B3261E", marginTop: 12 },
  cta: { marginTop: 24 },
  created: { marginTop: 8, gap: 12 },
  createdLabel: { fontSize: 14, fontWeight: "500", color: colors.ink1 },
});
