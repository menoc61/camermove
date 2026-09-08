"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"

// YOLO-style floating back-to-top: appears past 60% of the viewport,
// instant scroll + no entrance animation under prefers-reduced-motion.
export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.6
      setVisible(window.scrollY > threshold)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: shouldReduce ? "auto" : "smooth" })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="backtotop"
          onClick={scrollTop}
          aria-label="Retour en haut"
          initial={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 8 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          whileHover={shouldReduce ? undefined : { y: -2 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-5 right-5 z-[70] grid h-11 w-11 place-items-center rounded-full border bg-background text-foreground shadow-lg cursor-pointer"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
