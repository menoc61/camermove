"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"

interface ServicesBentoProps {
  hotelsCount: number
  rentalsCount: number
}

const services = [
  {
    n: "01",
    title: "Transport interurbain",
    body: "Comparez et réservez vos billets de bus entre villes. Départs quotidiens Yaoundé ⇄ Douala.",
    href: "/results?origin=Yaound%C3%A9&destination=Douala&pax=1",
    cta: "Réserver un bus",
    span: "hero" as const,
    art: "transport",
  },
  {
    n: "02",
    title: "Hôtels & appartements",
    body: "Une sélection d’hébergements vérifiés, du studio meublé à l’appartement familial.",
    href: "/hotels",
    cta: "Voir les hébergements",
    span: "sm" as const,
    art: "hotel",
  },
  {
    n: "03",
    title: "Location de véhicules",
    body: "Particuliers, SUV, minibus — avec ou sans chauffeur.",
    href: "/rentals",
    cta: "Louer un véhicule",
    span: "sm" as const,
    art: "rental",
  },
  {
    n: "04",
    title: "Transport de colis",
    body: "Envoi sécurisé vers toutes les grandes villes du Cameroun.",
    href: "/parcels",
    cta: "Envoyer un colis",
    span: "sm" as const,
    art: "parcel",
  },
  {
    n: "05",
    title: "Assurance voyage",
    body: "Couverture souscrite en ligne, attestation numérique immédiate.",
    href: "/insurance",
    cta: "Souscrire une assurance",
    span: "sm" as const,
    art: "shield",
  },
  {
    n: "06",
    title: "Billetterie événements",
    body: "Concerts, festivals, sport — billet QR sur votre téléphone.",
    href: "/events",
    cta: "Voir les événements",
    span: "wide" as const,
    art: "ticket",
  },
]

function ServiceArt({ kind }: { kind: string }) {
  /* Geometric Swiss-style illustration per service. No external assets. */
  if (kind === "transport") {
    return (
      <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden>
        <rect width="400" height="320" fill="#0E0E0E" />
        <rect x="0" y="220" width="400" height="100" fill="#1A1A1A" />
        <line x1="0" y1="220" x2="400" y2="220" stroke="#3A3A3A" strokeDasharray="4 8" />
        <rect x="60" y="80" width="280" height="120" fill="#F5F4F1" />
        <rect x="60" y="80" width="280" height="22" fill="#B89B7B" />
        <rect x="80" y="120" width="50" height="40" fill="#0E0E0E" opacity="0.8" />
        <rect x="150" y="120" width="50" height="40" fill="#0E0E0E" opacity="0.8" />
        <rect x="220" y="120" width="50" height="40" fill="#0E0E0E" opacity="0.8" />
        <rect x="290" y="120" width="40" height="40" fill="#0E0E0E" opacity="0.8" />
        <circle cx="110" cy="220" r="22" fill="#0E0E0E" />
        <circle cx="110" cy="220" r="10" fill="#F5F4F1" />
        <circle cx="290" cy="220" r="22" fill="#0E0E0E" />
        <circle cx="290" cy="220" r="10" fill="#F5F4F1" />
        <text x="20" y="40" fill="#F5F4F1" fontSize="11" fontFamily="ui-sans-serif" letterSpacing="2">
          YAOUNDE → DOUALA · 245KM
        </text>
      </svg>
    )
  }
  if (kind === "hotel") {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden>
        <rect width="240" height="240" fill="#F5F4F1" />
        <rect x="40" y="60" width="160" height="140" fill="#FFFFFF" stroke="#0E0E0E" />
        <rect x="60" y="80" width="40" height="40" fill="#0E0E0E" />
        <rect x="140" y="80" width="40" height="40" fill="#0E0E0E" />
        <rect x="60" y="140" width="120" height="14" fill="#0E0E0E" />
        <line x1="40" y1="60" x2="200" y2="60" stroke="#B89B7B" strokeWidth="3" />
      </svg>
    )
  }
  if (kind === "rental") {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden>
        <rect width="240" height="240" fill="#F5F4F1" />
        <rect x="40" y="120" width="160" height="50" fill="#FFFFFF" stroke="#0E0E0E" />
        <rect x="60" y="100" width="120" height="40" fill="#0E0E0E" />
        <rect x="80" y="110" width="30" height="22" fill="#F5F4F1" />
        <rect x="130" y="110" width="30" height="22" fill="#F5F4F1" />
        <circle cx="80" cy="180" r="16" fill="#0E0E0E" />
        <circle cx="160" cy="180" r="16" fill="#0E0E0E" />
        <circle cx="80" cy="180" r="6" fill="#F5F4F1" />
        <circle cx="160" cy="180" r="6" fill="#F5F4F1" />
      </svg>
    )
  }
  if (kind === "parcel") {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden>
        <rect width="240" height="240" fill="#F5F4F1" />
        <rect x="60" y="60" width="120" height="120" fill="#B89B7B" />
        <line x1="60" y1="120" x2="180" y2="120" stroke="#0E0E0E" strokeWidth="2" />
        <line x1="120" y1="60" x2="120" y2="180" stroke="#0E0E0E" strokeWidth="2" />
        <rect x="100" y="100" width="40" height="40" fill="#0E0E0E" />
      </svg>
    )
  }
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden>
        <rect width="240" height="240" fill="#F5F4F1" />
        <path
          d="M120 40 L180 60 L180 130 Q180 180 120 200 Q60 180 60 130 L60 60 Z"
          fill="#0E0E0E"
        />
        <text x="120" y="135" fill="#B89B7B" fontSize="48" textAnchor="middle" fontFamily="ui-sans-serif" fontWeight="500">
          ✓
        </text>
      </svg>
    )
  }
  // ticket
  return (
    <svg viewBox="0 0 480 240" className="h-full w-full" aria-hidden>
      <rect width="480" height="240" fill="#0E0E0E" />
      <line x1="240" y1="40" x2="240" y2="200" stroke="#3A3A3A" strokeDasharray="3 6" />
      <rect x="40" y="80" width="160" height="80" fill="#F5F4F1" />
      <rect x="280" y="80" width="160" height="80" fill="#B89B7B" />
      <text x="60" y="170" fill="#0E0E0E" fontSize="11" letterSpacing="2" fontFamily="ui-sans-serif">
        FESTIVAL · YAOUNDE
      </text>
      <text x="300" y="170" fill="#0E0E0E" fontSize="11" letterSpacing="2" fontFamily="ui-sans-serif">
        QR · 24.06.2026
      </text>
    </svg>
  )
}

export function ServicesBento({ hotelsCount, rentalsCount }: ServicesBentoProps) {
  const shouldReduce = useReducedMotion()

  return (
    <section
      id="services"
      aria-label="Les six services CamerMove"
      className="border-t border-line bg-paper text-ink"
    >
      <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
        <div className="mb-12 grid grid-cols-12 gap-x-6 gap-y-8 md:mb-16">
          <div className="col-span-12 md:col-span-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
              04 — Services
            </p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
              Une plateforme, six services — le transport reste le produit héros.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:flex md:items-end md:justify-end">
            <p className="max-w-[40ch] text-[15px] leading-[1.55] text-ink-1">
              Réservez un trajet, puis prolongez l’expérience : une chambre, un
              véhicule, un événement. Tout reste dans le même compte.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-12 md:grid-rows-[auto_auto]">
          {/* Hero card — transport */}
          {services.slice(0, 1).map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="group relative col-span-1 row-span-1 flex flex-col justify-between overflow-hidden bg-ink text-paper md:col-span-7 md:row-span-2"
              aria-label={s.title}
            >
              <div className="absolute inset-0">
                <ServiceArt kind={s.art} />
              </div>
              <div className="relative z-10 flex items-start justify-between p-6 sm:p-8">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/60">
                  {s.n} · Produit héros
                </span>
                <span
                  aria-hidden
                  className="block h-px w-10 bg-white/45 transition-all group-hover:w-16"
                />
              </div>
              <div className="relative z-10 p-6 sm:p-8">
                <h3 className="text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.02em]">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.55] text-white/70">
                  {s.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-paper">
                  {s.cta}
                  <span aria-hidden className="block h-px w-8 bg-paper" />
                </span>
              </div>
            </Link>
          ))}

          {/* Small cards */}
          {services.slice(1, 5).map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="group relative col-span-1 row-span-1 flex flex-col overflow-hidden bg-surface-1 md:col-span-5"
              aria-label={s.title}
            >
              <div className="flex items-start justify-between border-b border-line p-5 sm:p-6">
                <span className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                  {s.n}
                </span>
                <span
                  aria-hidden
                  className="block h-px w-8 bg-ink transition-all group-hover:w-14"
                />
              </div>
              <div className="aspect-[16/9] w-full overflow-hidden border-b border-line">
                <ServiceArt kind={s.art} />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                <div>
                  <h3 className="text-xl font-medium tracking-[-0.015em]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.55] text-ink-1">
                    {s.body}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-ink-1 group-hover:text-ink">
                  {s.cta}
                </span>
              </div>
            </Link>
          ))}

          {/* Wide card — events */}
          {services.slice(5).map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="group relative col-span-1 row-span-1 flex flex-col justify-between overflow-hidden bg-ink text-paper md:col-span-12"
              aria-label={s.title}
            >
              <div className="grid grid-cols-12 items-center">
                <div className="col-span-12 md:col-span-7">
                  <div className="aspect-[2/1] w-full">
                    <ServiceArt kind={s.art} />
                  </div>
                </div>
                <div className="col-span-12 flex flex-col gap-4 p-6 sm:p-8 md:col-span-5 md:p-12">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                    {s.n}
                  </span>
                  <h3 className="text-[clamp(1.6rem,2.4vw,2.2rem)] font-medium leading-[1.05] tracking-[-0.02em]">
                    {s.title}
                  </h3>
                  <p className="text-[15px] leading-[1.55] text-white/70">
                    {s.body}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-paper">
                    {s.cta}
                    <span aria-hidden className="block h-px w-8 bg-paper" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Counter band */}
        <motion.div
          initial={shouldReduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 grid grid-cols-2 gap-px bg-line md:mt-16 md:grid-cols-4"
        >
          {[
            { label: "Hébergements", value: hotelsCount || "—" },
            { label: "Véhicules", value: rentalsCount || "—" },
            { label: "Services", value: "Six" },
            { label: "Compte unique", value: "CamerMove ID" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-2 bg-paper px-5 py-7 sm:px-7 sm:py-9"
            >
              <span className="text-[10px] uppercase tracking-[0.22em] text-ink-2">
                {s.label}
              </span>
              <span className="text-[clamp(1.2rem,1.8vw,1.6rem)] font-medium tracking-[-0.02em] num-tabular">
                {s.value}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
