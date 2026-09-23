import { Stack } from "expo-router";
import { BookScreen } from "@/screens/book";

export default function BookRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Réserver" }} />
      <BookScreen />
    </>
  );
}
