import { Stack } from "expo-router";
import { TicketDetailScreen } from "@/screens/ticket-detail";

export default function TicketDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Billet" }} />
      <TicketDetailScreen />
    </>
  );
}
