import { cn } from "@/lib/utils"

export interface AgencyOption {
  transporterId: string
  companyName: string
}

/**
 * Multi-agency comparison filter (05-01 Task 5): "Toutes" + one chip per agency
 * found on the route. Monochrome — active chip is black, inactive bordered grey.
 */
export function AgencyChips({
  agencies,
  value,
  onChange,
  className,
}: {
  agencies: AgencyOption[]
  value?: string
  onChange: (transporterId: string | undefined) => void
  className?: string
}) {
  if (agencies.length === 0) return null
  return (
    <div role="group" aria-label="Filtrer par agence" className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-pressed={value == null}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          value == null
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-zinc-200 bg-card text-zinc-600 hover:border-zinc-400",
        )}
      >
        Toutes les agences
      </button>
      {agencies.map((a) => {
        const active = value === a.transporterId
        return (
          <button
            key={a.transporterId}
            type="button"
            onClick={() => onChange(active ? undefined : a.transporterId)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-zinc-200 bg-card text-zinc-600 hover:border-zinc-400",
            )}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-white" : "bg-stone-900")} />
            {a.companyName}
          </button>
        )
      })}
    </div>
  )
}
