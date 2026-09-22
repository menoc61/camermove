"use client"
import { useEffect, useState } from "react"
import { listBookings, listPayments, listCommissions } from "@/lib/api/transporter"
import { DataTable, type Column } from "@/components/dashboard-v2/panels/DataTable"

type BookingRow = { id: string; reference: string; seatCount: number; totalAmount: number; status: string }
type PaymentRow = { id: string; amount: number; status: string; provider: string }
type CommissionRow = { id: string; commissionAmount: number; netAmount: number; payoutStatus: string }

const TABS = [
  { value: "bookings", label: "Réservations" },
  { value: "payments", label: "Paiements" },
  { value: "commissions", label: "Commissions" },
] as const

type Tab = typeof TABS[number]["value"]

const BOOKING_COLUMNS: Column[] = [
  { key: "reference", label: "Référence", render: (v) => <span className="font-mono text-xs">{String(v ?? "")}</span> },
  { key: "seatCount", label: "Places", sortValue: (row) => Number(row.seatCount ?? 0) },
  {
    key: "totalAmount",
    label: "Montant",
    render: (v) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    sortValue: (row) => Number(row.totalAmount ?? 0),
  },
  { key: "status", label: "Statut" },
]

const PAYMENT_COLUMNS: Column[] = [
  {
    key: "amount",
    label: "Montant",
    render: (v) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    sortValue: (row) => Number(row.amount ?? 0),
  },
  { key: "provider", label: "Opérateur" },
  { key: "status", label: "Statut" },
  { key: "id", label: "ID", render: (v) => <span className="font-mono text-xs">{String(v ?? "")}</span>, sortable: false },
]

const COMMISSION_COLUMNS: Column[] = [
  {
    key: "commissionAmount",
    label: "Commission",
    render: (v) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    sortValue: (row) => Number(row.commissionAmount ?? 0),
  },
  {
    key: "netAmount",
    label: "Net",
    render: (v) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    sortValue: (row) => Number(row.netAmount ?? 0),
  },
  { key: "payoutStatus", label: "Versement" },
]

export function BookingsClient({ token }: { token: string }) {
  const [bookings,setBookings]=useState<BookingRow[]>([])
  const [payments,setPayments]=useState<PaymentRow[]>([])
  const [commissions,setCommissions]=useState<CommissionRow[]>([])
  const [tab,setTab]=useState<Tab>("bookings")
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState({ bookings: true, payments: true, commissions: true })
  useEffect(()=>{
    listBookings(token).then(r=>setBookings(r.items as never)).catch(e=>setError(e.message)).finally(()=>setLoading(l=>({ ...l, bookings: false })))
    listPayments(token).then(r=>setPayments(r.items as never)).catch(()=>{}).finally(()=>setLoading(l=>({ ...l, payments: false })))
    listCommissions(token).then(r=>setCommissions(r.items as never)).catch(e=>setError(e.message)).finally(()=>setLoading(l=>({ ...l, commissions: false })))
  },[token])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Réservations &amp; paiements</h1>
      <div className="flex gap-2">
        {TABS.map((t)=>(
          <button key={t.value} onClick={()=>setTab(t.value)} className={`rounded-full px-4 py-1.5 text-sm font-medium border ${tab===t.value?"bg-primary text-primary-foreground":"bg-card"}`}>{t.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {tab==="bookings" && (
        <DataTable
          columns={BOOKING_COLUMNS}
          data={bookings as unknown as Record<string, unknown>[]}
          isLoading={loading.bookings}
          emptyMessage="Aucune réservation."
        />
      )}
      {tab==="payments" && (
        <DataTable
          columns={PAYMENT_COLUMNS}
          data={payments as unknown as Record<string, unknown>[]}
          isLoading={loading.payments}
          emptyMessage="Aucun paiement."
        />
      )}
      {tab==="commissions" && (
        <DataTable
          columns={COMMISSION_COLUMNS}
          data={commissions as unknown as Record<string, unknown>[]}
          isLoading={loading.commissions}
          emptyMessage="Aucune commission."
        />
      )}
    </div>
  )
}
