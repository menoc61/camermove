"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { motion, useScroll, useTransform } from "motion/react"
import { QrCode, ShieldCheck, Wallet } from "lucide-react"
import { SearchBar } from "../search/search-bar"
import { IntroOverlay } from "./IntroOverlay"

const trust = [
  { icon: ShieldCheck, label: "Paiement Mobile Money sécurisé" },
  { icon: QrCode, label: "E-billet QR immédiat" },
  { icon: Wallet, label: "Meilleurs prix du jour" },
]

const trustContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.6 },
  },
}

const trustItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
}

interface HeroProps {
  minPrice?: number
}

export function Hero({ minPrice }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let tl: gsap.core.Timeline | null = null

    async function animate() {
      const gsapModule = await import("gsap")
      const gsap = gsapModule.default

      gsap.set(".line span", { y: "100%", skewY: 7, opacity: 0 })

      tl = gsap.timeline({ delay: 0.5 })
      tl.to(".line span", {
        y: "0%",
        skewY: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.12,
      })
    }

    animate()

    return () => {
      if (tl) tl.kill()
    }
  }, [])

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  })

  const imgY1 = useTransform(scrollYProgress, [0, 1], [40, -40])
  const imgY2 = useTransform(scrollYProgress, [0, 1], [60, -20])

  return (
    <section className="relative overflow-hidden bg-background">
      <div
        ref={heroRef}
        className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12"
      >
        <div className="lg:col-span-6">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Yaoundé ⇄ Douala · quotidien
          </p>
          <h1 className="max-w-xl font-display text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground md:text-7xl">
            <div className="line">
              <span>Le bus Yaoundé–Douala,</span>
            </div>
            <div className="line">
              <span>réservé en deux minutes.</span>
            </div>
          </h1>
          <p className="mt-5 max-w-[52ch] font-body text-base font-medium leading-relaxed text-muted-foreground md:text-lg">
            Comparez les départs du jour, payez par Mobile Money et recevez votre
            e-billet QR immédiatement.
          </p>

          <div className="relative z-10 mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-lg shadow-slate-900/5 sm:p-5">
            <SearchBar />
          </div>

          <motion.ul
            variants={trustContainer}
            initial="hidden"
            animate="visible"
            className="mt-8 flex flex-wrap gap-x-6 gap-y-3"
          >
            {trust.map(({ icon: Icon, label }) => (
              <motion.li
                key={label}
                variants={trustItem}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon
                  className="h-4 w-4 text-primary-dark"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {label}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <div className="relative hidden lg:col-span-6 lg:block">
          <motion.div
            style={{ y: imgY1 }}
            className="hero-image relative ml-auto aspect-[4/5] w-[78%] overflow-hidden rounded-2xl shadow-xl shadow-amber-900/15"
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
                À partir de{" "}
                {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF
              </span>
            )}
          </motion.div>
          <motion.div
            style={{ y: imgY2 }}
            className="hero-image absolute -bottom-6 left-0 aspect-[16/10] w-[46%] rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white shadow-lg shadow-amber-900/10"
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
