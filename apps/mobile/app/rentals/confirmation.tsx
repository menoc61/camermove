import { Stack } from "expo-router";
import { RentalConfirmationScreen } from "@/screens/rental-confirmation";

export default function RentalConfirmationRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Confirmation" }} />
      <RentalConfirmationScreen />
    </>
  );
}
