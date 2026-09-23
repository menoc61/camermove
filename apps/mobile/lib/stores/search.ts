import { create } from "zustand";

interface SearchState {
  origin: string;
  destination: string;
  date: string;
  pax: number;
  setSearch: (s: Partial<Omit<SearchState, "setSearch" | "reset">>) => void;
  reset: () => void;
}

function tomorrow(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

export const useSearchStore = create<SearchState>((set) => ({
  origin: "Yaoundé",
  destination: "Douala",
  date: tomorrow(),
  pax: 1,
  setSearch: (s) => set(s),
  reset: () => set({ origin: "Yaoundé", destination: "Douala", date: tomorrow(), pax: 1 }),
}));
