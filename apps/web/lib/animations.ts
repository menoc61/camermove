"use client"

import type { Variants, Transition } from "motion/react"

export const ease = [0.23, 1, 0.32, 1] as const // --ease-out
export const easeInOut = [0.77, 0, 0.175, 1] as const

export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
}

export const springSoft: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
}

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  visible: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.35, ease } },
}

export const hoverLift = {
  y: -6,
  transition: spring,
}

export const tapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
}

export const hoverUnderline = {
  hidden: { scaleX: 0, originX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.2, ease } },
}
