"use client"
import { useState } from "react"

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [msg, setMsg] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("loading")
    setMsg("")
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form) as unknown as Iterable<[string, string]>)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus("ok")
      setMsg("Message envoyé — nous vous répondons vite !")
      form.reset()
    } catch (err) {
      setStatus("error")
      setMsg(err instanceof Error ? err.message : "Erreur d'envoi")
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Nom</span>
          <input name="name" required className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Votre nom" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="vous@exemple.cm" />
        </label>
      </div>
      <label className="space-y-1.5 block">
        <span className="text-sm font-medium">Message</span>
        <textarea name="message" required rows={5} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Votre message..." />
      </label>
      <button type="submit" disabled={status === "loading"} className="inline-flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {status === "loading" ? "Envoi..." : "Envoyer"}
      </button>
      {msg && <p className={`text-sm ${status === "ok" ? "text-green-600" : "text-destructive"}`}>{msg}</p>}
    </form>
  )
}
