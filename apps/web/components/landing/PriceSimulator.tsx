"use client"

import { useRef, useCallback } from "react"
import Link from "next/link"
import { useState } from "react"
import { ArrowUpDown, Search } from "lucide-react"
import gsap from "gsap"
import { motion, AnimatePresence } from "motion/react"
import { fetchSearch } from "../../lib/api/search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { CityAutocomplete } from "@/components/search/CityAutocomplete"
import { priceXaf } from "@camermove/shared"
import { scaleIn, spring } from "@/lib/animations"

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PriceSimulator() {
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [date, setDate] = useState(todayPlus(1))
  const [pax, setPax] = useState("1")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ min: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [swapKey, setSwapKey] = useState(0)

  const swapIconRef = useRef<HTMLDivElement>(null)

  const swap = useCallback(() => {
    setOrigin(destination)
    setDestination(origin)
    setSwapKey((k) => k + 1)
    if (swapIconRef.current) {
      gsap.to(swapIconRef.current, {
        rotation: "+=180",
        duration: 0.35,
        ease: "back.out(1.7)",
      })
    }
  }, [origin, destination])

  async function check() {
    if (!origin || !destination) {
      setError("Veuillez remplir la ville de départ et la destination.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSearch({
        origin,
        destination,
        date,
        pax: Number(pax),
        sortBy: "price_asc",
      })
      if (res.items.length === 0) {
        setResult(null)
        setError(`Aucun départ pour ${origin} → ${destination} — prochaine ouverture bientôt.`)
      } else {
        const prices = res.items.map((t) => t.price)
        const min = prices[0]!
        setResult({ min, total: res.pagination.total })
      }
    } catch {
      setError("Impossible de vérifier les prix — réessayez.")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const resultsHref = `/results?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}&pax=${pax}`

  return (
    <div className="rounded-2xl bg-surface-1 p-6 shadow-md">
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Field>
            <FieldLabel htmlFor="sim-origin">Départ</FieldLabel>
            <CityAutocomplete
              id="sim-origin"
              value={origin}
              onChange={setOrigin}
              placeholder="Ville de départ"
              aria-label="Ville de départ"
            />
          </Field>
          <div className="flex items-end pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={swap}
              aria-label="Inverser départ et destination"
              className="rounded-full"
            >
              <div ref={swapIconRef}>
                <ArrowUpDown className="h-4 w-4" />
              </div>
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor="sim-dest">Destination</FieldLabel>
            <CityAutocomplete
              id="sim-dest"
              value={destination}
              onChange={setDestination}
              placeholder="Ville d'arrivée"
              aria-label="Ville d'arrivée"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field>
            <FieldLabel htmlFor="sim-date">Date de départ</FieldLabel>
            <Input
              id="sim-date"
              type="date"
              value={date}
              min={todayPlus(0)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sim-pax">Passagers</FieldLabel>
            <Select value={pax} onValueChange={(v) => setPax(v ?? "1")}>
              <SelectTrigger id="sim-pax" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button
          onClick={check}
          disabled={!origin || !destination}
          loading={loading}
          className="rounded-full font-bold"
        >
          {!loading && <Search data-icon="inline-start" aria-hidden />}
          {loading ? "Vérification…" : "Vérifier le prix"}
        </Button>

        <div aria-live="polite" className="min-h-10 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          <AnimatePresence mode="wait">
            {result && !loading && (
              <motion.p
                key={`${result.min}-${result.total}`}
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="text-foreground"
              >
                Dès{" "}
                <span className="text-xl font-bold tracking-tight">
                  {priceXaf(result.min)}
                </span>{" "}
                par place · {result.total} départ{result.total > 1 ? "s" : ""}.{" "}
                {pax !== "1" && (
                  <>Total dès {priceXaf(result.min * Number(pax))} pour {pax} passagers. </>
                )}
                {origin && (
                  <Link
                    href={resultsHref}
                    className="group relative inline-block font-semibold text-primary-dark"
                  >
                    Choisir mon départ →
                    <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-primary-dark transition-transform duration-200 group-hover:scale-x-100" />
                  </Link>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </FieldGroup>
    </div>
  )
}
