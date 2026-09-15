"use client"

import Link from "next/link"
import { useState } from "react"
import { motion, useMotionValueEvent, useScroll } from "motion/react"
import { useOverlayNav } from "@/lib/motion"
import { useAuthStore } from "@camermove/frontend"
import { cn } from "@/lib/utils"

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Accueil" },
  { href: "/results", label: "Transport interurbain" },
  { href: "/hotels", label: "Hôtels & apparts" },
  { href: "/rentals", label: "Location véhicules" },
  { href: "/parcels", label: "Transport colis" },
  { href: "/events", label: "Billetterie" },
  { href: "/dashboard", label: "Mes réservations" },
]

/**
 * YOLO-style navigation: fixed minimal header + full-screen overlay on ALL
 * viewports. Overlay slides down (expo.inOut 0.75s) and links rise in with a
 * stagger (expo.out, 0.07s) — exact port of yolo-web's SiteHeader timeline.
 * Reduced-motion users get the same content instantly (no hidden states).
 */
export function SiteNav() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [scrolled, setScrolled] = useState(false)
  // Overlay open/close, hamburger morph, GSAP timelines, scroll-lock,
  // Escape + focus trap — all owned by the shared motion adapter.
  const nav = useOverlayNav()
  const {
    isOpen,
    close: closeNav,
    toggle,
    hamburgerRef,
    linesRef,
    overlayRef,
    linksRef,
    onKeyDown,
  } = nav
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20)
  })

  return (
    <>
      <motion.header
        className={cn(
          "fixed top-0 left-0 right-0 transition-colors duration-300",
          isOpen ? "z-[70]" : "z-50",
          scrolled && !isOpen
            ? "border-b border-border bg-surface-0/80 backdrop-blur-xl"
            : "border-b-transparent bg-transparent"
        )}
        initial={false}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="CamerMove, accueil">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-[4px] transition-colors duration-300",
                isOpen ? "bg-white" : "bg-primary"
              )}
            />
            <span
              className={cn(
                "text-lg font-bold tracking-tight transition-colors duration-300",
                isOpen ? "text-white" : "text-foreground"
              )}
            >
              CamerMove
            </span>
          </Link>

          {/* Actions: Compte + hamburger (all viewports, like yolo) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Link
                href={accessToken ? "/dashboard" : "/login"}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg border px-4 text-sm font-semibold transition-colors",
                  isOpen
                    ? "border-white/40 text-white hover:bg-white/10"
                    : "border-input bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {accessToken ? "Compte" : "Se connecter"}
              </Link>
            </motion.div>

            <motion.button
              ref={hamburgerRef}
              onClick={toggle}
              aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={isOpen}
              aria-controls="cm-nav-overlay"
              className={cn(
                "relative z-[70] flex h-10 w-10 flex-col items-center justify-center gap-[6px] rounded-full transition-colors duration-300",
                isOpen ? "bg-white" : "bg-transparent"
              )}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <span
                ref={(el) => {
                  linesRef.current[0] = el
                }}
                className={cn("block h-0.5 w-6 transition-colors duration-300", isOpen ? "bg-ink" : "bg-foreground")}
              />
              <span
                ref={(el) => {
                  linesRef.current[1] = el
                }}
                className={cn("block h-0.5 w-6 transition-colors duration-300", isOpen ? "bg-ink" : "bg-foreground")}
              />
              <span
                ref={(el) => {
                  linesRef.current[2] = el
                }}
                className={cn("block h-0.5 w-6 transition-colors duration-300", isOpen ? "bg-ink" : "bg-foreground")}
              />
            </motion.button>
          </div>
        </nav>
      </motion.header>

      {/* Full-screen overlay — display controlled by GSAP (.is-open for reduced-motion) */}
      <div
        id="cm-nav-overlay"
        ref={overlayRef}
        onKeyDown={onKeyDown}
        className={cn("nav-overlay", isOpen && "is-open")}
        aria-hidden={!isOpen}
      >
        <div className="nav-overlay__inner">
          <ul className="nav-links">
            {NAV_LINKS.map((link, i) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  ref={(el) => {
                    linksRef.current[i] = el
                  }}
                  onClick={closeNav}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div>
            <div className="nav-contact__label">Contact</div>
            <a href="mailto:contact@camermove.cm" className="nav-contact__item">
              contact@camermove.cm
            </a>
            <div
              className="nav-contact__item"
              style={{ color: "#888", marginTop: 16, lineHeight: 1.8, fontSize: "0.85rem" }}
            >
              Yaoundé · Douala
              <br />
              Cameroun
            </div>
            <div className="nav-contact__item" style={{ marginTop: 16 }}>
              <Link href="/contact" onClick={closeNav} className="nav-contact__cta">
                Contactez-nous →
              </Link>
            </div>
          </div>

          {/* Quicklinks — utility pages */}
          <div className="nav-quicklinks">
            <div className="nav-quicklinks__label">Informations</div>
            <ul className="nav-quicklinks__list">
              <li>
                <Link href="/faq" onClick={closeNav}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" onClick={closeNav}>
                  Comment ça marche
                </Link>
              </li>
              <li>
                <Link href="/legal" onClick={closeNav}>
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/contact" onClick={closeNav}>
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/become-partner" onClick={closeNav}>
                  Devenir partenaire
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
