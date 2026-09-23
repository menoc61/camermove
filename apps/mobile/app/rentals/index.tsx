import { Stack } from "expo-router";
import { RentalsListScreen } from "@/screens/rentals-list";

export default function RentalsIndexRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Locations" }} />
      <RentalsListScreen />
    </>
  );
}
