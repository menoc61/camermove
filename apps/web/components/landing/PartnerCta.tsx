"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"

const benefits = [
  { label: "Milliers de voyageurs servis chaque jour" },
  { label: "Revenus et remplissage accrus" },
  { label: "Inscription en moins de dix minutes" },
]

export function PartnerCta() {
  const shouldReduce = useReducedMotion()

  return (
    <section
      aria-label="Devenir partenaire"
      className="border-t border-line bg-ink text-paper"
    >
      <div className="mx-auto max-w-[1560px] px-6 py-16 sm:px-8 md:px-12 md:py-24">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="col-span-12 md:col-span-7"
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
              12 — Partenaires
            </p>
            <h2 className="mt-4 text-[clamp(2rem,3.8vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
              Vous exploitez des bus, des véhicules, des chambres ou des événements&nbsp;?
            </h2>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.55] text-white/65">
              Rejoignez le réseau CamerMove. Un seul espace, vos trajets, vos
              hôtels, vos véhicules, vos colis, vos événements — distribués à
              des milliers de voyageurs camerounais qui paient en Mobile Money.
            </p>
          </motion.div>

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="col-span-12 flex flex-col gap-8 md:col-span-5 md:items-end md:justify-end"
          >
            <ul className="flex flex-col gap-3">
              {benefits.map((b) => (
                <li
                  key={b.label}
                  className="flex items-center gap-3 text-[13px] leading-snug text-white/75"
                >
                  <span className="block h-px w-6 bg-white/45" aria-hidden />
                  {b.label}
                </li>
              ))}
            </ul>
            <Link
              href="/transporter/apply"
              className="group inline-flex items-center gap-3 border border-paper bg-paper px-7 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-ink transition-colors hover:bg-transparent hover:text-paper"
            >
              Devenir partenaire
              <span
                aria-hidden
                className="block h-px w-8 bg-ink transition-all group-hover:w-12 group-hover:bg-paper"
              />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
