import { Stack } from "expo-router";
import { HotelBookScreen } from "@/screens/hotel-book";

export default function HotelBookRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Réserver l'hôtel" }} />
      <HotelBookScreen />
    </>
  );
}
