import { Stack } from "expo-router";
import { RentalDetailScreen } from "@/screens/rental-detail";

export default function RentalDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Détail du véhicule" }} />
      <RentalDetailScreen />
    </>
  );
}
