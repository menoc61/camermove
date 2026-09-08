"use client"

import { usePathname } from "next/navigation"
import { SiteNav } from "./landing/SiteNav"

// Routes that own their chrome (auth flows, booking flow, app shells).
const HIDDEN_PREFIXES = [
  "/dashboard",
  "/admin",
  "/transporter",
  "/partner",
  "/login",
  "/register",
  "/auth",
  "/book",
  "/trips",
  "/tickets",
]

export function RouteAwareNav() {
  const pathname = usePathname()
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null
  return <SiteNav />
}
