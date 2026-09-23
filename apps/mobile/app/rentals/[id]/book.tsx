import { Stack } from "expo-router";
import { RentalBookScreen } from "@/screens/rental-book";

export default function RentalBookRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Réserver le véhicule" }} />
      <RentalBookScreen />
    </>
  );
}
