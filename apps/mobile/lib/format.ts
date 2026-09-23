export function formatXAF(amount: number): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} FCFA`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "expiré";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function occupancy(totalSeats: number, seatsAvailable: number): number {
  if (!totalSeats) return 0;
  return Math.round(((totalSeats - seatsAvailable) / totalSeats) * 100);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Départ imminent";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Départ imminent";
  if (h === 1) return "dans 1h";
  return `dans ${h}h`;
}
