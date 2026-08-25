import { create } from "zustand"

interface SearchState {
  origin: string
  destination: string
  date: string
  pax: number
  setSearch: (s: Partial<Omit<SearchState, "setSearch" | "reset">>) => void
  reset: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  origin: "Yaoundé",
  destination: "Douala",
  date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  pax: 1,
  setSearch: (s) => set(s),
  reset: () => set({ origin: "Yaoundé", destination: "Douala", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), pax: 1 }),
}))
