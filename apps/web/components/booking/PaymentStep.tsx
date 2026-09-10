"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { Smartphone, CreditCard, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type PaymentStepProvider = "notchpay" | "cinetpay"
export type PaymentStepMethod = "mobile_money" | "card"
export interface PaymentStepResult {
  paymentUrl?: string | null
  authorizationUrl?: string | null
  payment?: unknown
}

interface PaymentStepProps {
  amount: number
  currency?: string
  onPaymentCreated?: (r: PaymentStepResult) => void
  createPayment: (
    provider: PaymentStepProvider,
    opts: { method?: string; phone?: string }
  ) => Promise<PaymentStepResult>
}

const MICRO_LABEL = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"

export function PaymentStep({ amount, currency = "XAF", onPaymentCreated, createPayment }: PaymentStepProps) {
  const baseId = useId()
  const providerLegendId = `${baseId}-provider`
  const methodLabelId = `${baseId}-method`
  const phoneInputId = `${baseId}-phone`
  const [provider, setProvider] = useState<PaymentStepProvider>("notchpay")
  const [method, setMethod] = useState<PaymentStepMethod>("mobile_money")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatted = `${new Intl.NumberFormat("fr-CM").format(amount)} ${currency}`

  async function submit() {
    if (method === "mobile_money" && phone && !/^\+?[1-9]\d{7,14}$/.test(phone.replace(/\s/g, ""))) {
      const msg = "Numéro de téléphone invalide (format E.164 attendu)"
      setError(msg)
      toast.error(msg)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await createPayment(provider, {
        method,
        phone: method === "mobile_money" && phone ? phone : undefined,
      })
      const url = r.paymentUrl ?? r.authorizationUrl
      if (url) {
        window.location.href = url
        return
      }
      onPaymentCreated?.(r)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'initiation du paiement"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-line bg-surface-0 rounded-none p-4 space-y-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <p className={MICRO_LABEL}>Paiement</p>
        <p className="text-lg font-bold num-tabular">{formatted}</p>
      </div>

      <fieldset aria-labelledby={providerLegendId}>
        <p id={providerLegendId} className={`${MICRO_LABEL} mb-2`}>
          Fournisseur
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Fournisseur de paiement">
          {(
            [
              { id: "notchpay" as const, icon: Smartphone, label: "Mobile Money", note: "via NotchPay" },
              { id: "cinetpay" as const, icon: CreditCard, label: "Carte", note: "via CinetPay" },
            ]
          ).map((o) => {
            const selected = provider === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setProvider(o.id)}
                className={`flex items-center gap-2 border bg-white px-3 py-2.5 min-h-[44px] rounded-none text-left cursor-pointer ${
                  selected ? "border-ink" : "border-line"
                }`}
              >
                <o.icon size={16} aria-hidden />
                <span className="text-sm font-semibold flex-1 text-ink">{o.label}</span>
                <span className="text-[11px] text-muted-foreground">{o.note}</span>
                <span
                  aria-hidden
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selected ? "bg-ink border-ink" : "bg-white border-line"
                  }`}
                />
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label id={methodLabelId} htmlFor={`${baseId}-method-select`} className={`${MICRO_LABEL} mb-2 block`}>
          Méthode
        </label>
        <select
          id={`${baseId}-method-select`}
          aria-labelledby={methodLabelId}
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentStepMethod)}
          className="w-full min-h-[44px] rounded-none border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-ink"
        >
          <option value="mobile_money">Mobile Money</option>
          <option value="card">Carte bancaire</option>
        </select>
      </div>

      {method === "mobile_money" && (
        <div>
          <label htmlFor={phoneInputId} className={`${MICRO_LABEL} mb-2 block`}>
            Téléphone Mobile Money
          </label>
          <Input
            id={phoneInputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+237 6XX XX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-none min-h-[44px]"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={submit}
        loading={loading}
        disabled={loading}
        className="w-full rounded-none bg-ink text-paper min-h-[44px] hover:bg-ink/90"
      >
        {loading ? "Redirection…" : `Payer ${formatted}`}
      </Button>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck size={14} aria-hidden /> Paiement sécurisé, aucune donnée bancaire stockée par CamerMove.
      </p>
    </div>
  )
}
