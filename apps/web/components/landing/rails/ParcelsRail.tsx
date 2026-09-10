"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

// Client-side mirror of apps/api/src/parcels/service.ts calcShippingCost
// defaults: base 500 + perKg 100 × weightKg (+ perType + declaredValue ×
// declaredRate, both 0 by default). Labeled "indicatif" in the UI — the
// authoritative price is computed server-side at booking time.
const PARCEL_BASE_XAF = 500
const PARCEL_PER_KG_XAF = 100

const formatXaf = (v: number) => new Intl.NumberFormat("fr-FR").format(v)

function estimateShipping(weightKg: number): number {
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 1
  return Math.round(PARCEL_BASE_XAF + PARCEL_PER_KG_XAF * w)
}

const cardShell =
  "w-[78vw] shrink-0 snap-start border border-line bg-surface-1 sm:w-[380px]"

function TrackParcelCard() {
  const router = useRouter()
  const [number, setNumber] = useState("")

  function go() {
    const n = number.trim()
    if (!n) return
    router.push(`/parcels/track/${encodeURIComponent(n)}`)
  }

  return (
    <div className={`${cardShell} flex flex-col p-5`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-2">
        Suivi en direct
      </p>
      <p className="mt-2 text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink">
        Où est mon colis&nbsp;?
      </p>
      <p className="mt-2 text-[13px] leading-[1.55] text-ink-1">
        Saisissez votre numéro de suivi (ex.&nbsp;CM-XXXX-XXXX), reçu après
        l&apos;enregistrement en agence.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <label htmlFor="parcels-track-input" className="sr-only">
          Numéro de suivi
        </label>
        <input
          id="parcels-track-input"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go()
          }}
          placeholder="CM-XXXX-XXXX"
          autoComplete="off"
          className="min-h-[44px] w-full border border-ink/25 bg-paper px-3 text-[14px] text-ink placeholder:text-ink-2 focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={go}
          disabled={!number.trim()}
          className="inline-flex min-h-[44px] items-center justify-center border border-ink bg-ink px-5 text-[12px] font-medium uppercase tracking-[0.22em] text-paper transition-colors hover:bg-transparent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivre mon colis
        </button>
      </div>
    </div>
  )
}

function EstimatorCard() {
  const [from, setFrom] = useState("Yaoundé")
  const [to, setTo] = useState("Douala")
  const [weight, setWeight] = useState("2")

  const w = Number(weight)
  const valid = from.trim() !== "" && to.trim() !== "" && Number.isFinite(w) && w > 0
  const estimate = valid ? estimateShipping(w) : null

  const inputClass =
    "min-h-[44px] w-full border border-ink/25 bg-paper px-3 text-[14px] text-ink placeholder:text-ink-2 focus:border-ink focus:outline-none"

  return (
    <div className={`${cardShell} flex flex-col p-5`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-2">
        Estimation indicative
      </p>
      <p className="mt-2 text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink">
        Combien coûte mon envoi&nbsp;?
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="parcels-est-from" className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Départ
          </label>
          <input
            id="parcels-est-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Yaoundé"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="parcels-est-to" className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Arrivée
          </label>
          <input
            id="parcels-est-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Douala"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="parcels-est-weight" className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Poids (kg)
          </label>
          <input
            id="parcels-est-weight"
            type="number"
            min={0.5}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <p aria-live="polite" className="mt-4 border-t border-line pt-3 text-[12px] uppercase tracking-[0.14em] text-ink-1">
        {estimate != null ? (
          <>
            ≈ {formatXaf(estimate)} XAF · {from.trim()} → {to.trim()} · indicatif
          </>
        ) : (
          <>Renseignez les trois champs pour estimer.</>
        )}
      </p>
    </div>
  )
}

const IMG = "?q=80&w=800&auto=format&fit=crop"

export function ParcelsRail() {
  return (
    <ServiceRail
      index="05"
      kicker="Transport de colis"
      title="Vos colis voyagent avec vos bus."
      intro="Déposez en agence, suivez en ligne, retirez à l'arrivée. Estimation indicative en un geste."
      href="/parcels"
      hrefLabel="Expédier un colis"
    >
      <ServiceRailCard
        href="/parcels"
        image={`https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d${IMG}`}
        imageAlt="Livreur transportant un colis"
        top="Yaoundé · Douala · 4h"
        title="Yaoundé → Douala"
        bottom="Dès 1 500 XAF · indicatif"
        badge="Populaire"
      />
      <ServiceRailCard
        href="/parcels"
        image={`https://images.unsplash.com/photo-1587293852726-70cdb56c2866${IMG}`}
        imageAlt="Colis empilés dans un entrepôt"
        top="Yaoundé · Bafoussam · 6h"
        title="Yaoundé → Bafoussam"
        bottom="Dès 2 000 XAF · indicatif"
      />
      <ServiceRailCard
        href="/parcels"
        image={`https://images.unsplash.com/photo-1601584115197-04ecc0da31d7${IMG}`}
        imageAlt="Étagères d'entrepôt logistique"
        top="Douala · Limbé · 1h30"
        title="Douala → Limbé"
        bottom="Dès 1 000 XAF · indicatif"
      />
      <TrackParcelCard />
      <EstimatorCard />
    </ServiceRail>
  )
}
