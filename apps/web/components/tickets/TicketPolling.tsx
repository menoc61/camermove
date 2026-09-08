"use client"
import { useEffect, useState } from "react"
import { TicketDetail } from "./TicketDetail"
import type { TicketDetailResponse } from "../../lib/api/tickets"

export function TicketPolling({ initial, token, id }: { initial: TicketDetailResponse; token: string; id: string }) {
  const [data, setData] = useState(initial)
  const [polling, setPolling] = useState(initial.status !== "valid" && initial.status !== "used" && initial.status !== "void")

  useEffect(() => {
    if (!polling) return
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${base}/api/v1/me/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as TicketDetailResponse
        setData(json)
        if (json.status === "valid" || json.status === "used" || json.status === "void") setPolling(false)
      } catch {}
    }, 5000)
    return () => clearInterval(iv)
  }, [polling, token, id])

  return (
    <div className="space-y-3">
      {polling && <p className="text-center text-xs text-muted-foreground">Mise à jour automatique du statut toutes les 5s...</p>}
      <TicketDetail data={data} />
    </div>
  )
}
