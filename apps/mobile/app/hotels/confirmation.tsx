import { Stack } from "expo-router";
import { HotelConfirmationScreen } from "@/screens/hotel-confirmation";

export default function HotelConfirmationRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Confirmation" }} />
      <HotelConfirmationScreen />
    </>
  );
}
