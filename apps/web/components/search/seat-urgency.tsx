import { cn } from "@/lib/utils"

/**
 * Monochrome live-inventory indicator (05-01 Task 4/6).
 * Urgency is conveyed by copy + an opacity pulse (transform/opacity only,
 * no box-shadow/colour outside the black/white/grey theme).
 */
export function SeatUrgency({ seatsAvailable, className }: { seatsAvailable: number; className?: string }) {
  if (seatsAvailable <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400", className)}>
        <span aria-hidden className="size-1.5 rounded-full bg-zinc-300" />
        Complet
      </span>
    )
  }
  if (seatsAvailable < 5) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-[#C0392B]", className)}>
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-[#C0392B] motion-reduce:animate-none"
        />
        Plus que {seatsAvailable} place{seatsAvailable > 1 ? "s" : ""} — sièges libres
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-zinc-600", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-zinc-400" />
      {seatsAvailable} places disponibles
    </span>
  )
}
