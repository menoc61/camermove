import { Stack } from "expo-router";
import { ConfirmationScreen } from "@/screens/confirmation";

export default function ConfirmationRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Confirmation" }} />
      <ConfirmationScreen />
    </>
  );
}
