import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="tickets" options={{ title: "Billets" }} />
      <Tabs.Screen name="account" options={{ title: "Compte" }} />
    </Tabs>
  );
}
