"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function YoloHeader() {
  const [menuOpened, setMenuOpened] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMenuOpened(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (menuOpened) {
      document.documentElement.style.overflow = "hidden"
    } else {
      document.documentElement.style.overflow = ""
    }
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [menuOpened])

  return (
    <div
      className="yolo-header"
      data-scrolled={scrolled ? "true" : "false"}
      data-menu-open={menuOpened ? "true" : "false"}
    >
      <div className="container">
        <div className="row v-center space-between">
          <div className="logo">
            <Link href="/" aria-label="CamerMove — Accueil">
              CamerMove
            </Link>
          </div>
          <div
            className="nav-toggle"
            onClick={() => setMenuOpened((v) => !v)}
            role="button"
            aria-label={menuOpened ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpened}
          >
            <div className="hamburger-menu" aria-hidden>
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
