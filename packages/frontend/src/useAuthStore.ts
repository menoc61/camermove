import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AuthUser { id: string; email: string; role: string }
interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (a: { accessToken: string; user: AuthUser }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: ({ accessToken, user }) => set({ accessToken, user }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: "camermove-auth" }
  )
)
