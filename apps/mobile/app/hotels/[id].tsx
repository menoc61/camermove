import { Stack } from "expo-router";
import { HotelDetailScreen } from "@/screens/hotel-detail";

export default function HotelDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Hôtel" }} />
      <HotelDetailScreen />
    </>
  );
}
