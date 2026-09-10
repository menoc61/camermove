"use client"

import type { Variants, Transition } from "motion/react"

export const ease = [0.23, 1, 0.32, 1] as const // --ease-out

export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease } },
}

export const tapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
}
