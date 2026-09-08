"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

type Strength = 0 | 1 | 2 | 3 | 4

interface PasswordStrengthMeterProps {
  password: string
  /** Show only when the user has started typing. */
  visible?: boolean
}

const STRENGTH_LABELS = ["", "Très faible", "Faible", "Moyen", "Fort", "Très fort"] as const
const STRENGTH_COLORS = [
  "bg-muted",
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
] as const

function score(pwd: string): Strength {
  if (!pwd) return 0
  let s = 0
  if (pwd.length >= 8) s++
  if (pwd.length >= 12) s++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++
  if (/\d/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  // 0–5 → map to 1–4
  if (s === 0) return 1
  if (s <= 2) return 2
  if (s <= 3) return 3
  if (s <= 4) return 4
  return 4
}

export function PasswordStrengthMeter({ password, visible = true }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => score(password), [password])
  if (!visible || !password) return null

  const label = STRENGTH_LABELS[strength] ?? ""
  const color = STRENGTH_COLORS[strength] ?? "bg-muted"

  return (
    <div
      className="space-y-1.5"
      role="status"
      aria-live="polite"
      aria-label={`Force du mot de passe : ${label}`}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => {
          const filled = i <= strength
          return (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                filled ? color : "bg-muted",
              )}
            />
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Force : <span className="font-medium text-foreground">{label}</span>
        {strength <= 2 && password.length > 0 && (
          <> · 12 caractères, majuscules et chiffres recommandés</>
        )}
      </p>
    </div>
  )
}
