import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { refreshAccessToken } from "../api/auth";
import type { AuthUser } from "../api/auth";
import { apiBase } from "../api/resource";

const AUTH_STORAGE_KEY = "cm-auth";

const secureStorage: StateStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const B64CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Hermes-safe base64url decode (no atob/Buffer). Returns null on any failure. */
function decodeJwtExpMs(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const bytes: number[] = [];
    let bits = 0;
    let bitCount = 0;
    for (const ch of normalized) {
      if (ch === "=") break;
      const v = B64CHARS.indexOf(ch);
      if (v < 0) return null;
      bits = (bits << 6) | v;
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        bytes.push((bits >> bitCount) & 0xff);
      }
    }
    let json = "";
    for (const b of bytes) json += String.fromCharCode(b);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (a: { accessToken: string; refreshToken?: string | null; user: AuthUser }) => void;
  clearAuth: () => void;
  isAccessTokenExpired: (skewSeconds?: number) => boolean;
  refreshIfNeeded: (opts?: { skewSeconds?: number }) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, user, refreshToken: refreshToken ?? null }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAccessTokenExpired: (skewSeconds = 30) => {
        const { accessToken } = get();
        if (!accessToken) return true;
        const exp = decodeJwtExpMs(accessToken);
        if (exp === null) return false;
        return Date.now() >= exp - skewSeconds * 1000;
      },
      refreshIfNeeded: async (opts) => {
        const { accessToken, refreshToken, user } = get();
        if (!accessToken || !refreshToken) return false;
        if (!get().isAccessTokenExpired(opts?.skewSeconds)) return true;
        try {
          const data = await refreshAccessToken(refreshToken);
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user ?? user });
          return true;
        } catch (err) {
          if (err instanceof Error && (err as { status?: number }).status === 401) get().clearAuth();
          return false;
        }
      },
      logout: async () => {
        const { accessToken, refreshToken } = get();
        try {
          if (accessToken) {
            await fetch(`${apiBase()}/api/v1/auth/logout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(refreshToken ? { refreshToken } : {}),
            });
          }
        } catch {
          // best-effort: store is cleared regardless
        } finally {
          get().clearAuth();
        }
      },
    }),
    { name: AUTH_STORAGE_KEY, storage: createJSONStorage(() => secureStorage) },
  ),
);

/** Await SecureStore rehydration before gating UI on auth state (root layout). */
export async function hydrateAuth(): Promise<void> {
  await useAuthStore.persist.rehydrate();
}
