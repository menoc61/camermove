"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"
import { ArrowRight, MapPin, Sparkles } from "lucide-react"
import { SearchBar } from "../search/search-bar"

interface HeroProps {
  minPrice?: number
}

export function Hero({ minPrice }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  })

  const imgY1 = useTransform(scrollYProgress, [0, 1], [20, -20])
  const imgY2 = useTransform(scrollYProgress, [0, 1], [30, -10])
  const bgOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.3])

  return (
    <section className="relative overflow-hidden">
      {/* Warm gradient background with pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--brand-dark)/0.03)] via-background to-[hsl(var(--brand-light)/0.05)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C75B39' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

      <div
        ref={heroRef}
        className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:pb-24"
      >
        {/* Content */}
        <div className="lg:col-span-6">
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--brand)/0.2)] bg-[hsl(var(--brand)/0.08)] px-4 py-2 text-sm font-medium text-[hsl(var(--brand-dark))]"
          >
            <Sparkles className="h-4 w-4" />
            <span>La mobilité africaine réinventée</span>
          </motion.div>

          <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            <motion.span
              initial={shouldReduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="block"
            >
              Voyagez au Cameroun,
            </motion.span>
            <motion.span
              initial={shouldReduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="block text-gradient"
            >
              en toute simplicité.
            </motion.span>
          </h1>

          <motion.p
            initial={shouldReduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="mt-5 max-w-[50ch] text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Un bus, un hôtel, une voiture ou un colis — réservez en quelques clics,
            payez par Mobile Money, recevez votre billet instantanément.
          </motion.p>

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="relative z-10 mt-8 max-w-xl rounded-2xl border border-border/50 bg-card p-4 shadow-warm sm:p-5"
          >
            <SearchBar />
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[hsl(var(--brand))]" />
              Yaoundé → Douala
            </span>
            {minPrice != null && (
              <span className="flex items-center gap-1.5 font-medium text-[hsl(var(--brand-dark))]">
                Dès {new Intl.NumberFormat("fr-FR").format(minPrice)} XAF
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
              6 services
            </span>
          </motion.div>
        </div>

        {/* Visual */}
        <div className="relative hidden lg:col-span-6 lg:block">
          <motion.div style={shouldReduce ? undefined : { opacity: bgOpacity }}>
            <motion.div
              style={shouldReduce ? undefined : { y: imgY1 }}
              className="hero-image relative ml-auto aspect-[4/5] w-[80%] overflow-hidden rounded-3xl shadow-warm will-change-transform"
            >
              <Image
                src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=1000&fit=crop"
                alt="Route panoramique au Cameroun"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 0vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--brand-dark)/0.3)] to-transparent" />
              {minPrice != null && (
                <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/90 backdrop-blur-sm px-4 py-3 shadow-lg">
                  <p className="text-xs font-medium text-muted-foreground">Départ aujourd'hui</p>
                  <p className="text-lg font-bold text-foreground">Dès {new Intl.NumberFormat("fr-FR").format(minPrice)} XAF</p>
                </div>
              )}
            </motion.div>

            <motion.div
              style={shouldReduce ? undefined : { y: imgY2 }}
              className="hero-image absolute -bottom-4 left-0 aspect-[16/10] w-[48%] overflow-hidden rounded-2xl border-[3px] border-white shadow-lg will-change-transform"
            >
              <Image
                src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&h=380&fit=crop"
                alt="Bus interurbain moderne"
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 22vw, 0vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </motion.div>

            {/* Floating badge */}
            <motion.div
              initial={shouldReduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute -right-2 top-8 rounded-xl bg-white px-3 py-2 shadow-lg"
            >
              <p className="text-xs font-medium text-muted-foreground">Prochain départ</p>
              <p className="text-sm font-bold text-[hsl(var(--brand))]">Aujourd'hui 14h30</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
