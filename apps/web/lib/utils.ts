import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Darken (negative percent) or lighten a #rrggbb hex color. Single copy —
 *  use this instead of local duplicates. */
export function shade(hex: string, percent: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const num = parseInt(m[1]!, 16)
  const clamp = (n: number) => Math.min(255, Math.max(0, n))
  const r = clamp(((num >> 16) & 0xff) + Math.round((percent / 100) * 255))
  const g = clamp(((num >> 8) & 0xff) + Math.round((percent / 100) * 255))
  const b = clamp((num & 0xff) + Math.round((percent / 100) * 255))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
