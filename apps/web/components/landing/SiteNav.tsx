"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from "motion/react"
import { cn } from "@/lib/utils"
import { staggerContainer, staggerItem, hoverLift } from "@/lib/animations"
import type { Variants } from "motion/react"

const NAV_LINKS: { href: string; label: string; isLink?: boolean }[] = [
  { href: "#etapes", label: "Comment ça marche" },
  { href: "#agences", label: "Agences" },
  { href: "#departures", label: "Prochains départs" },
  { href: "/transporter/apply", label: "Devenir partenaire", isLink: true },
]

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
}

const staggerLinks: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

const staggerLinkItem: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const linesRef = useRef<(HTMLSpanElement | null)[]>([])
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20)
  })

  const animateHamburger = useCallback(
    async (open: boolean) => {
      const gsap = (await import("gsap")).default
      const [line1, line2, line3] = linesRef.current
      if (!line1 || !line2 || !line3) return

      if (open) {
        gsap.to(line1, { y: 8, rotate: 45, duration: 0.3, ease: "power2.out" })
        gsap.to(line2, { opacity: 0, scaleX: 0, duration: 0.2, ease: "power2.out" })
        gsap.to(line3, { y: -8, rotate: -45, duration: 0.3, ease: "power2.out" })
      } else {
        gsap.to(line1, { y: 0, rotate: 0, duration: 0.3, ease: "power2.out" })
        gsap.to(line2, { opacity: 1, scaleX: 1, duration: 0.2, ease: "power2.out" })
        gsap.to(line3, { y: 0, rotate: 0, duration: 0.3, ease: "power2.out" })
      }
    },
    []
  )

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => {
      const next = !prev
      animateHamburger(next)
      document.body.style.overflow = next ? "hidden" : ""
      return next
    })
  }, [animateHamburger])

  useEffect(() => {
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <>
      <motion.header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
          scrolled
            ? "border-b border-border bg-surface-0/80 backdrop-blur-xl"
            : "border-b-transparent bg-transparent"
        )}
        initial={false}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="CamerMove — accueil">
            <motion.span
              className="inline-block h-3 w-3 rounded-[4px] bg-primary"
              aria-hidden
              whileHover={{ scale: 1.2, transition: { duration: 0.2 } }}
            />
            <motion.span
              className="text-lg font-bold tracking-tight text-foreground"
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            >
              CamerMove
            </motion.span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map((link) =>
              link.isLink ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative py-1 transition-colors hover:text-foreground"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100" />
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="group relative py-1 transition-colors hover:text-foreground"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100" />
                </a>
              )
            )}
          </div>

          {/* Login button */}
          <motion.div whileHover={hoverLift} className="hidden md:block">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-4 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Se connecter
            </Link>
          </motion.div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            onClick={toggleMobile}
            className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
          >
            <span
              ref={(el) => { linesRef.current[0] = el }}
              className="block h-0.5 w-6 bg-foreground"
            />
            <span
              ref={(el) => { linesRef.current[1] = el }}
              className="block h-0.5 w-6 bg-foreground"
            />
            <span
              ref={(el) => { linesRef.current[2] = el }}
              className="block h-0.5 w-6 bg-foreground"
            />
          </button>
        </nav>
      </motion.header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col bg-surface-0/95 backdrop-blur-xl md:hidden"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex h-16 items-center px-4" />
            <motion.nav
              className="flex flex-col items-start gap-2 px-8 pt-8"
              variants={staggerLinks}
              initial="hidden"
              animate="visible"
            >
              {NAV_LINKS.map((link) => (
                <motion.div key={link.href} variants={staggerLinkItem}>
                  {link.isLink ? (
                    <Link
                      href={link.href}
                      onClick={toggleMobile}
                      className="block py-3 text-2xl font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={toggleMobile}
                      className="block py-3 text-2xl font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  )}
                </motion.div>
              ))}

              <motion.div variants={staggerLinkItem} className="mt-6">
                <Link
                  href="/login"
                  onClick={toggleMobile}
                  className="inline-flex h-12 items-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Se connecter
                </Link>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
