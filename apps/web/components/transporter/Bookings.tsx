// @ts-nocheck
"use client"
import { useEffect, useState } from "react"
import { listBookings, listPayments, listCommissions } from "@/lib/api/transporter"

export function BookingsClient({ token }: { token: string }) {
  const [bookings,setBookings]=useState<{ id:string; reference:string; seatCount:number; totalAmount:number; status:string }[]>([])
  const [payments,setPayments]=useState<{ id:string; amount:number; status:string; provider:string }[]>([])
  const [commissions,setCommissions]=useState<{ id:string; commissionAmount:number; netAmount:number; payoutStatus:string }[]>([])
  const [tab,setTab]=useState<"bookings"|"payments"|"commissions">("bookings")
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    listBookings(token).then(r=>setBookings(r.items as never)).catch(e=>setError(e.message))
    listPayments(token).then(r=>setPayments(r.items as never)).catch(()=>{})
    listCommissions(token).then(r=>setCommissions(r.items as never)).catch(()=>{})
  },[token])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Réservations &amp; paiements</h1>
      <div className="flex gap-2">
        {(["bookings","payments","commissions"] as const).map((t)=>(
          <button key={t} onClick={()=>setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium border ${tab===t?"bg-primary text-primary-foreground":"bg-card"}`}>{t}</button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {tab==="bookings" && (
        <ul className="divide-y rounded-2xl border">
          {bookings.map((b)=><li key={b.id} className="p-4"><div className="font-mono text-sm">{b.reference}</div><div className="text-xs text-muted-foreground">{b.seatCount} place(s) · {b.totalAmount.toLocaleString()} XAF · {b.status}</div></li>)}
          {bookings.length===0 && <li className="p-6 text-sm text-muted-foreground">Aucune réservation.</li>}
        </ul>
      )}
      {tab==="payments" && (
        <ul className="divide-y rounded-2xl border">
          {payments.map((p)=><li key={p.id} className="p-4"><div className="font-medium">{p.amount.toLocaleString()} XAF — {p.provider}</div><div className="text-xs text-muted-foreground">{p.status} · {p.id}</div></li>)}
          {payments.length===0 && <li className="p-6 text-sm text-muted-foreground">Aucun paiement.</li>}
        </ul>
      )}
      {tab==="commissions" && (
        <ul className="divide-y rounded-2xl border">
          {commissions.map((c)=><li key={c.id} className="p-4"><div className="font-medium">Commission {c.commissionAmount.toLocaleString()} XAF · net {c.netAmount.toLocaleString()}</div><div className="text-xs text-muted-foreground">{c.payoutStatus}</div></li>)}
          {commissions.length===0 && <li className="p-6 text-sm text-muted-foreground">Aucune commission.</li>}
        </ul>
      )}
    </div>
  )
}
