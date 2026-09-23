import { Stack } from "expo-router";
import { TripDetailScreen } from "@/screens/trip-detail";

export default function TripDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Détail du trajet" }} />
      <TripDetailScreen />
    </>
  );
}
