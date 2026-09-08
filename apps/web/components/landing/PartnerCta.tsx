"use client"

import Link from "next/link"
import { ArrowRight, Users, TrendingUp, Clock } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const benefits = [
  { icon: Users, label: "Milliers de voyageurs" },
  { icon: TrendingUp, label: "Revenus augmentés" },
  { icon: Clock, label: "Inscription 10 min" },
]

export function PartnerCta() {
  const shouldReduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden">
      {/* Warm gradient background */}
      <div className="absolute inset-0 bg-gradient-warm" />
      {/* Decorative circles */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          {/* Content */}
          <div>
            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-white/70">
                Espace partenaire
              </span>
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-white md:text-4xl">
                Vous exploitez des bus au Cameroun ?
              </h2>
              <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-white/80">
                Publiez vos trajets, remplissez vos sièges et encaissez en toute confiance.
                Rejoignez notre réseau de transporteurs partenaires.
              </p>
            </motion.div>

            {/* Benefits */}
            <motion.ul
              initial={shouldReduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-6 flex flex-wrap gap-4"
            >
              {benefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-white/90">
                  <Icon className="h-4 w-4 text-white/70" />
                  {label}
                </li>
              ))}
            </motion.ul>

            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-8"
            >
              <Link
                href="/transporter/apply"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[hsl(var(--brand-dark))] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                Devenir partenaire
                <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>

          {/* Visual element */}
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:flex md:justify-center"
          >
            <div className="relative">
              {/* Decorative card */}
              <div className="w-72 rounded-2xl bg-white/15 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20" />
                  <div>
                    <div className="h-3 w-24 rounded bg-white/40" />
                    <div className="mt-1.5 h-2 w-16 rounded bg-white/25" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full rounded bg-white/20" />
                  <div className="h-2 w-3/4 rounded bg-white/20" />
                  <div className="h-2 w-1/2 rounded bg-white/20" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-8 flex-1 rounded-lg bg-white/25" />
                  <div className="h-8 flex-1 rounded-lg bg-white/15" />
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 rounded-xl bg-white px-3 py-2 shadow-lg">
                <p className="text-xs font-medium text-muted-foreground">Nouveau</p>
                <p className="text-sm font-bold text-[hsl(var(--brand))]">+12 transporteurs</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
