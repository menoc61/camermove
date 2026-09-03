"use client"

import { Button } from "@/components/ui/button"

export function GoogleButton({ next, className }: { next?: string; className?: string }) {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const href = next ? `${api}/api/v1/auth/google?next=${encodeURIComponent(next)}` : `${api}/api/v1/auth/google`

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full rounded-full bg-white text-foreground hover:bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 ${className ?? ""}`}
      onClick={() => {
        window.location.href = href
      }}
      aria-label="Continuer avec Google"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.02 5.02 0 0 1-2.18 3.3v2.74h3.53c2.07-1.91 3.27-4.72 3.27-8.05z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.53-2.74A6.98 6.98 0 0 1 12 19.1c-2.84 0-5.25-1.92-6.11-4.49H2.25v2.82A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.89 14.6a6.6 6.6 0 0 1-.35-2.1c0-.73.13-1.44.35-2.1V7.58H2.25A11 11 0 0 0 0 12c0 1.8.44 3.5 1.2 5l3.69-2.4z" />
        <path fill="#EA4335" d="M12 5.38a6 6 0 0 1 4.22 1.65l3.16-3.16A11 11 0 0 0 12 1a11 11 0 0 0-9.75 6.58l3.69 2.82A6.98 6.98 0 0 1 12 5.38z" />
      </svg>
      <span className="font-medium">Continuer avec Google</span>
    </Button>
  )
}
