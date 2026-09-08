"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import Image from "next/image"
import gsap from "gsap"
import { Bus, ShieldCheck, Sparkles, Ticket } from "lucide-react"

const valueProps = [
  {
    icon: Bus,
    title: "Tous vos trajets en un compte",
    body: "Bus, hôtels, voitures, colis, événements — une seule connexion.",
  },
  {
    icon: Ticket,
    title: "E-billet QR instantané",
    body: "Reçu par e-mail dès la confirmation, valable à l'embarquement.",
  },
  {
    icon: ShieldCheck,
    title: "Paiement Mobile Money",
    body: "MTN MoMo et Orange Money acceptés, transactions chiffrées.",
  },
]

export function AnimatedAuthWrapper({
  title,
  subtitle,
  children,
  backHref = "/",
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  backHref?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

      tl.from(containerRef.current, {
        opacity: 0,
        duration: 0.4,
      })
        .from(
          "[data-auth-brand]",
          { opacity: 0, x: -16, duration: 0.5 },
          "-=0.1",
        )
        .from(
          "[data-auth-title]",
          { opacity: 0, y: 12, duration: 0.4 },
          "-=0.3",
        )
        .from(
          "[data-auth-subtitle]",
          { opacity: 0, y: 8, duration: 0.4 },
          "-=0.25",
        )
        .from(
          "[data-auth-children]",
          { opacity: 0, y: 16, duration: 0.5 },
          "-=0.2",
        )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/40"
    >
      {/* Brand panel — desktop only, full bleed left half */}
      <aside
        data-auth-brand
        aria-hidden
        className="relative hidden overflow-hidden bg-gradient-to-br from-brand-dark via-primary to-brand-light lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-1/2 xl:w-[55%]"
      >
        <Image
          src="https://picsum.photos/seed/camermove-auth-hero/1200/1600"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 0vw"
          className="object-cover opacity-30 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/95 via-brand-dark/40 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          {/* Logo */}
          <Link href={backHref} className="inline-flex items-center gap-2.5 group">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm transition-transform group-hover:scale-105">
              <Bus className="size-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">CamerMove</span>
          </Link>

          {/* Value props */}
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="size-3" />
              La mobilité africaine réinventée
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Voyagez, séjournez, expédiez —<br />
              tout depuis un seul compte.
            </h2>
            <ul className="space-y-4">
              {valueProps.map((v) => {
                const Icon = v.icon
                return (
                  <li key={v.title} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{v.title}</p>
                      <p className="text-sm text-white/75">{v.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Footer microcopy */}
          <p className="text-xs text-white/60">
            © 2026 CamerMove · Yaoundé · Douala · Cameroun
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 lg:ml-[50%] lg:px-12 xl:ml-[55%]">
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <Link
            href={backHref}
            data-auth-brand
            className="mb-6 inline-flex items-center gap-2 lg:hidden"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bus className="size-4" />
            </span>
            <span className="text-lg font-bold tracking-tight">CamerMove</span>
          </Link>

          <div className="mb-8">
            <h1
              data-auth-title
              className="text-3xl font-bold tracking-tighter"
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                data-auth-subtitle
                className="mt-2 text-sm text-muted-foreground"
              >
                {subtitle}
              </p>
            ) : null}
          </div>

          <div
            data-auth-children
            className="rounded-2xl border bg-card p-6 shadow-sm md:p-8"
          >
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
