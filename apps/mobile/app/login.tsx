import { Stack } from "expo-router";
import { LoginScreen } from "@/screens/login";

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Connexion" }} />
      <LoginScreen />
    </>
  );
}
