"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { openMenu, closeMenu } from "./menuAnimations"

export function YoloHeader() {
  const [menuOpened, setMenuOpened] = useState(false)
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 })
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setDimensions({ height: window.innerHeight, width: window.innerWidth })
    const onResize = () => setDimensions({ height: window.innerHeight, width: window.innerWidth })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // close on route change like Yolo header.js history.listen
  useEffect(() => {
    setMenuOpened(false)
  }, [pathname])

  useEffect(() => {
    if (menuOpened) openMenu(dimensions.width)
    else closeMenu()
  }, [menuOpened, dimensions.width])

  return (
    <div className="yolo-header">
      <div className="container">
        <div className="row v-center space-between">
          <div className="logo">
            <Link href="/">CamerMove</Link>
          </div>
          <div className="nav-toggle">
            <div onClick={() => setMenuOpened(true)} className="hamburger-menu" role="button" aria-label="Ouvrir le menu">
              <span />
              <span />
            </div>
            <div className="hamburger-menu-close" onClick={() => setMenuOpened(false)} role="button" aria-label="Fermer le menu">
              {/* exact UpArrow SVG from Yolo assets/up-arrow-circle.svg */}
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                <g id="Group_1" transform="translate(-152 -439)">
                  <line id="Line_1" y1="14.91" transform="translate(184 463.788)" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  <path id="Path_1" d="M6,9.155,10.949,5" transform="translate(173.051 458.302)" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  <path id="Path_2" d="M10.949,5,15.9,9.155" transform="translate(173.051 458.302)" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  <g id="Ellipse_1" transform="translate(152 439)" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2.5">
                    <circle cx="32" cy="32" r="32" stroke="none" />
                    <circle id="circle" cx="32" cy="32" r="30.75" fill="none" />
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
