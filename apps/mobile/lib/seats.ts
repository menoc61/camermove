import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { apiBase } from "./api/resource";

export type SeatState = "available" | "taken" | "held";

export function deriveSeatMap(totalSeats: number, seatsAvailable: number | null, picked: number | null): SeatState[] {
  if (seatsAvailable === null) {
    return Array.from({ length: totalSeats }, () => "available" as SeatState);
  }
  const takenCount = Math.max(0, totalSeats - seatsAvailable);
  return Array.from({ length: totalSeats }, (_, i) => {
    const n = i + 1;
    if (picked === n) return "held" as SeatState;
    if (n <= takenCount || n % 5 === 0) return "taken" as SeatState;
    return "available" as SeatState;
  });
}

export interface LiveSeats {
  seatsAvailable: number;
  totalSeats: number;
}

export function useLiveSeats(tripId: string | null, intervalMs = 10000): LiveSeats | null {
  const [seats, setSeats] = useState<LiveSeats | null>(null);
  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function fetchSeats() {
      if (AppState.currentState !== "active") return;
      try {
        const res = await fetch(`${apiBase()}/api/v1/trips/${tripId}`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { seatAvailability?: { seatsAvailable: number }; totalSeats: number };
        if (!alive) return;
        setSeats({
          seatsAvailable: data.seatAvailability?.seatsAvailable ?? data.totalSeats,
          totalSeats: data.totalSeats,
        });
      } catch {
        // keep stale seats on failure
      }
    }
    void fetchSeats();
    timer = setInterval(fetchSeats, intervalMs);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void fetchSeats();
    });
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [tripId, intervalMs]);
  return seats;
}
