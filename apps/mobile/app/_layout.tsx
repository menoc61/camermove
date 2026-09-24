import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query/client";
import { hydrateAuth } from "@/lib/auth/session";
import { ToastProvider } from "@/components/ui/toast";
import { ONBOARDED_KEY } from "./onboarding";
import { useReduceMotion } from "@/lib/motion";

import { useColorScheme } from "@/components/useColorScheme";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Page transitions stay on-brand: a 240ms slide-from-right with our easing
 * curve. When the OS reduce-motion flag is on, transitions collapse to instant
 * (0ms) to match the rest of the primitives.
 */
function usePageTransition() {
  const reduced = useReduceMotion();
  return {
    animation: "slide_from_right" as const,
    animationDuration: reduced ? 0 : 240,
    gestureEnabled: true,
  };
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateAuth().finally(() => setHydrated(true));
  }, []);

  if (!loaded || !hydrated) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const transition = usePageTransition();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((seen) => {
      if (!seen) router.replace("/onboarding");
    }).catch(() => { router.replace("/(tabs)"); });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={transition}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" as const, animationDuration: 280 }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: "fade" as const }} />
            <Stack.Screen name="trips/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="book/[tripId]" options={{ headerShown: false }} />
            <Stack.Screen name="book/confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="hotels" options={{ headerShown: false }} />
            <Stack.Screen name="hotels/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="hotels/[id]/book" options={{ headerShown: false, animation: "slide_from_bottom" as const, animationDuration: 280 }} />
            <Stack.Screen name="hotels/confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="tickets/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="tickets/lookup" options={{ headerShown: false }} />
            <Stack.Screen name="agencies" options={{ headerShown: false }} />
            <Stack.Screen name="agencies/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="rentals" options={{ headerShown: false }} />
            <Stack.Screen name="rentals/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="rentals/[id]/book" options={{ headerShown: false, animation: "slide_from_bottom" as const, animationDuration: 280 }} />
            <Stack.Screen name="rentals/confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="events" options={{ headerShown: false }} />
            <Stack.Screen name="events/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="events/[id]/book" options={{ headerShown: false, animation: "slide_from_bottom" as const, animationDuration: 280 }} />
            <Stack.Screen name="events/confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="parcels" options={{ headerShown: false }} />
            <Stack.Screen name="parcels/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="parcels/create" options={{ headerShown: false, animation: "slide_from_bottom" as const, animationDuration: 280 }} />
            <Stack.Screen name="parcels/track" options={{ headerShown: false }} />
            <Stack.Screen name="intraurban" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", animation: "slide_from_bottom" as const, animationDuration: 320 }}
            />
          </Stack>
        </ThemeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
