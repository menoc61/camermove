import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { apiBase } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; role: string };
}

export function parseGoogleCallbackUrl(url: string): GoogleTokens | null {
  const query = url.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const accessToken = params.get("accessToken");
  const userRaw = params.get("user");
  if (!accessToken || !userRaw) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userRaw)) as GoogleTokens["user"];
    if (!user?.id || !user?.email) return null;
    return { accessToken, refreshToken: params.get("refreshToken") ?? undefined, user };
  } catch {
    return null;
  }
}

export function GoogleButton({ onTokens, onError }: { onTokens: (t: GoogleTokens) => void; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const res = await WebBrowser.openAuthSessionAsync(
        `${apiBase()}/api/v1/auth/google?native=1`,
        "camermove://auth/callback",
      );
      if (res.type === "success") {
        const tokens = parseGoogleCallbackUrl(res.url);
        if (tokens) onTokens(tokens);
        else onError("Connexion Google incomplète. Réessayez.");
      } else if (res.type === "cancel" || res.type === "dismiss") {
        onError("Connexion Google annulée.");
      } else {
        onError("Échec de la connexion Google.");
      }
    } catch {
      onError("Échec de la connexion Google.");
    } finally {
      setBusy(false);
    }
  }
  return <Button label={busy ? "Google…" : "Continuer avec Google"} onPress={start} disabled={busy} />;
}
