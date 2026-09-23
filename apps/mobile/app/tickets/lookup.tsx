import { Stack } from "expo-router";
import { LookupScreen } from "@/screens/lookup";

export default function LookupRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Vérifier un billet" }} />
      <LookupScreen />
    </>
  );
}
