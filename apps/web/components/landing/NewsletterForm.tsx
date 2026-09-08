"use client"

import * as React from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type Status = "idle" | "loading" | "success" | "duplicate" | "error"

export function NewsletterForm() {
  const [email, setEmail] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === "loading") return
    setStatus("loading")
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? ""
      const res = await fetch(`${base}/api/v1/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { alreadySubscribed?: boolean }
      setStatus(data.alreadySubscribed ? "duplicate" : "success")
      if (!data.alreadySubscribed) setEmail("")
    } catch {
      setStatus("error")
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4" noValidate>
      <div className="flex max-w-md gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Adresse e-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          placeholder="votre@email.cm"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status !== "idle") setStatus("idle")
          }}
          className="h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-primary transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          {status === "loading" && <Loader2 className="size-4 animate-spin" />}
          S&apos;abonner
        </button>
      </div>
      <div aria-live="polite" className="mt-2 min-h-5 text-xs">
        {status === "success" && (
          <span className="inline-flex items-center gap-1 text-white">
            <CheckCircle2 className="size-3.5" /> Inscription confirmée. Merci !
          </span>
        )}
        {status === "duplicate" && (
          <span className="inline-flex items-center gap-1 text-white/90">
            <CheckCircle2 className="size-3.5" /> Vous êtes déjà abonné.
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-red-200">
            <AlertCircle className="size-3.5" /> Une erreur est survenue. Réessayez.
          </span>
        )}
      </div>
    </form>
  )
}
