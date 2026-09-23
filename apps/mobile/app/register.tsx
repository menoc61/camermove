import { Stack } from "expo-router";
import { RegisterScreen } from "@/screens/register";

export default function RegisterRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Inscription" }} />
      <RegisterScreen />
    </>
  );
}
