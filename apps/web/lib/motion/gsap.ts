"use client"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

let registered = false
export function ensureGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    gsap.defaults({ duration: 0.6, ease: "power3.out" })
    registered = true
  }
  return gsap
}

export function getMatchMedia() {
  ensureGsap()
  return gsap.matchMedia()
}

export { gsap, ScrollTrigger }
