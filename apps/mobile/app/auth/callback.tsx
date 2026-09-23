import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth/session";
import { parseGoogleCallbackUrl } from "@/components/auth/google-button";
import { useToast } from "@/components/ui/toast";
import { LoadingState } from "@/components/ui/screen-state";

export default function AuthCallbackRoute() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<Record<string, string>>();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const url = `camermove://auth/callback?${new URLSearchParams(params as Record<string, string>).toString()}`;
    const tokens = parseGoogleCallbackUrl(url);
    if (tokens) {
      setAuth({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
      toast("Connecté avec Google.");
      router.replace("/(tabs)");
    } else {
      toast("Échec de la connexion Google.");
      router.replace("/login");
    }
  }, [params, router, setAuth, toast]);

  return (
    <>
      <Stack.Screen options={{ title: "Connexion Google" }} />
      <LoadingState label="Finalisation de la connexion…" />
    </>
  );
}
