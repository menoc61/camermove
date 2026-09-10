"use client"
import { useRef } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Props {
  value: number
  min?: number
  max: number
  onChange: (n: number) => void
  label?: string
  id?: string
}

export function Stepper({ value, min = 1, max, onChange, label, id }: Props) {
  const minusRef = useRef<HTMLButtonElement>(null)
  const plusRef = useRef<HTMLButtonElement>(null)

  function animate(el: HTMLButtonElement | null) {
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    import("gsap").then(({ default: gsap }) => {
      gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.18, ease: "power2.out" })
    })
  }

  function dec() {
    const n = Math.max(min, value - 1)
    if (n !== value) {
      onChange(n)
      animate(minusRef.current)
    }
  }
  function inc() {
    const n = Math.min(max, value + 1)
    if (n !== value) {
      onChange(n)
      animate(plusRef.current)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        ref={minusRef}
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0 rounded-full border-zinc-200"
        onClick={dec}
        disabled={value <= min}
        aria-label={label ? `Diminuer ${label}` : "Diminuer"}
      >
        <Minus className="size-4" />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          let n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          n = Math.max(min, Math.min(max, Math.floor(n)))
          onChange(n)
        }}
        className={cn("w-16 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
        aria-label={label ?? "Nombre de tickets"}
      />
      <Button
        ref={plusRef}
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0 rounded-full border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white disabled:bg-zinc-100 disabled:text-zinc-400"
        onClick={inc}
        disabled={value >= max}
        aria-label={label ? `Augmenter ${label}` : "Augmenter"}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}
