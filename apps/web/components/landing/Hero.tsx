"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"
import { QrCode, ShieldCheck, Wallet } from "lucide-react"
import { SearchBar } from "../search/search-bar"
import { IntroOverlay } from "./IntroOverlay"

const trust = [
  { icon: ShieldCheck, label: "Paiement Mobile Money sécurisé" },
  { icon: QrCode, label: "E-billet QR immédiat" },
  { icon: Wallet, label: "Meilleurs prix du jour" },
]

interface HeroProps {
  minPrice?: number
}

export function Hero({ minPrice }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  // Purpose: spatial consistency (parallax) + state indication (trust list)
  // Tool: Motion (springs not needed, interruptible not needed) — use transform/opacity only, ease-out
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  })

  const imgY1 = useTransform(scrollYProgress, [0, 1], [20, -20])
  const imgY2 = useTransform(scrollYProgress, [0, 1], [30, -10])

  return (
    <section className="relative overflow-hidden bg-background">
      <div
        ref={heroRef}
        className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12"
      >
        <div className="lg:col-span-6">
          <motion.p
            initial={shouldReduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.6 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary"
          >
            Yaoundé ⇄ Douala · quotidien
          </motion.p>
          <h1 className="max-w-xl font-display text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground md:text-7xl">
            <span className="line overflow-hidden block">
              <span className="inline-block">Le bus Yaoundé–Douala,</span>
            </span>
            <span className="line overflow-hidden block">
              <span className="inline-block">réservé en deux minutes.</span>
            </span>
          </h1>
          <motion.p
            initial={shouldReduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.75 }}
            className="mt-5 max-w-[52ch] font-body text-base font-medium leading-relaxed text-muted-foreground md:text-lg"
          >
            Comparez les départs du jour, payez par Mobile Money et recevez votre
            e-billet QR immédiatement.
          </motion.p>

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, transform: "translateY(8px) scale(0.98)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.85 }}
            className="relative z-10 mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-lg shadow-ink-0/5 sm:p-5"
          >
            <SearchBar />
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.06, delayChildren: 0.95 },
              },
            }}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-3"
          >
            {trust.map(({ icon: Icon, label }) => (
              <motion.li
                key={label}
                variants={{
                  hidden: { opacity: 0, transform: "translateY(6px)" },
                  visible: {
                    opacity: 1,
                    transform: "translateY(0px)",
                    transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
                  },
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className="h-4 w-4 text-primary-dark" strokeWidth={1.75} aria-hidden />
                {label}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <div className="relative hidden lg:col-span-6 lg:block">
          <motion.div
            style={shouldReduce ? undefined : { y: imgY1 as unknown as number }}
            className="hero-image relative ml-auto aspect-[4/5] w-[78%] overflow-hidden rounded-2xl shadow-xl shadow-amber-900/15 will-change-transform"
          >
            <Image
              src="https://picsum.photos/seed/camermove-highway/900/1100"
              alt="Route interurbaine au Cameroun"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 0vw"
              className="object-cover"
            />
            {minPrice != null && (
              <span className="absolute left-4 top-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                À partir de {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF
              </span>
            )}
          </motion.div>
          <motion.div
            style={shouldReduce ? undefined : { y: imgY2 as unknown as number }}
            className="hero-image absolute -bottom-6 left-0 aspect-[16/10] w-[46%] rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white shadow-lg shadow-amber-900/10 will-change-transform"
          >
            <Image
              src="https://picsum.photos/seed/camermove-douala/720/450"
              alt="Départ de bus à Douala"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 24vw, 0vw"
              className="object-cover"
            />
          </motion.div>
        </div>
      </div>

      <IntroOverlay onComplete={() => {}} />
    </section>
  )
}
