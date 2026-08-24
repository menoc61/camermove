import { create } from "zustand"

interface PassengerDraft { fullName: string; phone?: string }
interface BookingState {
  tripId: string | null
  seatCount: number
  passengers: PassengerDraft[]
  setBooking: (s: Partial<Pick<BookingState, "tripId" | "seatCount" | "passengers">>) => void
  reset: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  tripId: null,
  seatCount: 1,
  passengers: [{ fullName: "" }],
  setBooking: (s) => set(s),
  reset: () => set({ tripId: null, seatCount: 1, passengers: [{ fullName: "" }] }),
}))
