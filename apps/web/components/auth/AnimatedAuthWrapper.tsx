"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

export function AnimatedAuthWrapper({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

      tl.from(containerRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.6,
      })
        .from(
          "[data-auth-title]",
          {
            opacity: 0,
            y: 12,
            duration: 0.4,
          },
          "-=0.3",
        )
        .from(
          "[data-auth-subtitle]",
          {
            opacity: 0,
            y: 8,
            duration: 0.4,
          },
          "-=0.25",
        )
        .from(
          "[data-auth-children]",
          {
            opacity: 0,
            y: 16,
            duration: 0.5,
          },
          "-=0.2",
        )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
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
      </div>
    </div>
  )
}
