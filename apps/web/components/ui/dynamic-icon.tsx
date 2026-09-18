import { icons, Bus, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * DynamicIcon — renders a Lucide icon by name.
 *
 * Icon names come from the `@camermove/shared` registry (`accentIcon`,
 * `AMENITY_LABEL[].icon`) so brand/amenity glyphs stay a single source of
 * truth. Unknown names fall back to `Bus` — never an emoji.
 */
export function DynamicIcon({
  name,
  className,
}: {
  name: string | null | undefined
  className?: string
}) {
  const C: LucideIcon = (name ? (icons as unknown as Record<string, LucideIcon>)[name] : undefined) ?? Bus
  return <C className={cn("size-4", className)} aria-hidden />
}
