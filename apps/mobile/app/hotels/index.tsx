import { Stack } from "expo-router";
import { HotelsListScreen } from "@/screens/hotels-list";

export default function HotelsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Hôtels" }} />
      <HotelsListScreen />
    </>
  );
}
