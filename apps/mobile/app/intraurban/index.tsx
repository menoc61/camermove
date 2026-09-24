import { Stack } from "expo-router";
import { IntraurbanLinesScreen } from "@/screens/intraurban-lines";

export default function IntraurbanIndexRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Trajets intra-urbains" }} />
      <IntraurbanLinesScreen />
    </>
  );
}
