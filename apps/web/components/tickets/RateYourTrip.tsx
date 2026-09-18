"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Multi-rating panel.
 *
 * Implements the user directive: "there have multiple rating there have
 * multiple agencies like general buca touristic global princess voyage etc
 * all of them do reaseaches" — travellers rate both the trip and the agency
 * independently, with optional sub-scores (punctuality, comfort, cleanliness,
 * service). Both submissions are POSTed to `/api/v1/reviews`.
 */

interface SubScores {
  punctuality: number
  comfort: number
  cleanliness: number
  service: number
}

interface ReviewResponse {
  items: Array<{
    id: string
    rating: number
    punctuality: number | null
    comfort: number | null
    cleanliness: number | null
    service: number | null
    comment: string | null
    createdAt: string
    author: { id: string; firstName: string | null; lastName: string | null }
  }>
  ratingAvg: number | null
  ratingCount: number
  total: number
  page: number
  limit: number
  totalPages: number
}

async function fetchTripReviews(tripId: string): Promise<ReviewResponse> {
  const res = await fetch(`/api/v1/reviews/trip/${tripId}`, { cache: "no-store" })
  if (!res.ok) throw new Error("fetch trip reviews failed")
  return res.json()
}

async function fetchTransporterReviews(transporterId: string): Promise<ReviewResponse> {
  const res = await fetch(`/api/v1/reviews/transporter/${transporterId}`, { cache: "no-store" })
  if (!res.ok) throw new Error("fetch transporter reviews failed")
  return res.json()
}

async function postReview(token: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/v1/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error("rate failed")
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors",
              value >= n ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-300",
            )}
          >
            <Star className={cn("size-4", value >= n && "fill-current")} />
          </button>
        ))}
      </div>
    </div>
  )
}

interface Props {
  tripId: string
  transporterId: string
  bookingId: string
  tripLabel: string
  agencyName: string
}

type Target = "trip" | "transporter"

export function RateYourTrip({ tripId, transporterId, bookingId, tripLabel, agencyName }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [target, setTarget] = useState<Target>("trip")
  const [rating, setRating] = useState(5)
  const [subs, setSubs] = useState<SubScores>({ punctuality: 5, comfort: 5, cleanliness: 5, service: 5 })
  const [comment, setComment] = useState("")
  const [done, setDone] = useState<Target | null>(null)

  const tripReviews = useQuery({
    queryKey: ["reviews", "trip", tripId],
    queryFn: () => fetchTripReviews(tripId),
  })
  const transporterReviews = useQuery({
    queryKey: ["reviews", "transporter", transporterId],
    queryFn: () => fetchTransporterReviews(transporterId),
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Vous devez être connecté pour noter")
      const payload =
        target === "trip"
          ? {
              target: "trip",
              tripId,
              bookingId,
              rating,
              punctuality: subs.punctuality,
              comfort: subs.comfort,
              cleanliness: subs.cleanliness,
              service: subs.service,
              comment: comment || undefined,
            }
          : {
              target: "transporter",
              transporterId,
              bookingId,
              rating,
              punctuality: subs.punctuality,
              comfort: subs.comfort,
              cleanliness: subs.cleanliness,
              service: subs.service,
              comment: comment || undefined,
            }
      await postReview(accessToken, payload)
    },
    onSuccess: () => {
      setDone(target)
      setComment("")
      qc.invalidateQueries({ queryKey: ["reviews", "trip", tripId] })
      qc.invalidateQueries({ queryKey: ["reviews", "transporter", transporterId] })
    },
  })

  const currentAvg = target === "trip"
    ? tripReviews.data?.ratingAvg
    : transporterReviews.data?.ratingAvg
  const currentCount = target === "trip"
    ? tripReviews.data?.ratingCount
    : transporterReviews.data?.ratingCount

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Star className="size-3.5 text-amber-500 fill-current" /> Notez votre voyage
            </p>
            <h2 className="mt-1 text-base font-semibold">Comment était votre trajet&nbsp;?</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            <Star className="size-3 text-amber-500 fill-current" />
            {currentAvg != null ? currentAvg.toFixed(1) : "—"} · {currentCount ?? 0} avis
          </div>
        </header>

        {/* Target switch */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTarget("trip")}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
              target === "trip"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-border bg-muted/30 text-muted-foreground hover:border-amber-200",
            )}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] opacity-80">Trajet</span>
            <span className="block text-sm font-semibold">{tripLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setTarget("transporter")}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
              target === "transporter"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-border bg-muted/30 text-muted-foreground hover:border-amber-200",
            )}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] opacity-80">Agence</span>
            <span className="block text-sm font-semibold">{agencyName}</span>
          </button>
        </div>

        {done === target ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" />
            Merci ! Votre note pour {target === "trip" ? "ce trajet" : "cette agence"} a été enregistrée.
          </div>
        ) : (
          <>
            {/* Main rating */}
            <div className="flex flex-col gap-3 rounded-xl border p-3">
              <Stars value={rating} onChange={setRating} label="Note globale" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Stars value={subs.punctuality} onChange={(v) => setSubs((s) => ({ ...s, punctuality: v }))} label="Ponctualité" />
                <Stars value={subs.comfort} onChange={(v) => setSubs((s) => ({ ...s, comfort: v }))} label="Confort" />
                <Stars value={subs.cleanliness} onChange={(v) => setSubs((s) => ({ ...s, cleanliness: v }))} label="Propreté" />
                <Stars value={subs.service} onChange={(v) => setSubs((s) => ({ ...s, service: v }))} label="Service" />
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire à partager ?"
              className="min-h-[72px] w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              maxLength={2000}
            />

            <Button
              type="button"
              onClick={() => submit.mutate()}
              disabled={!accessToken || submit.isPending}
              className="w-full rounded-full"
            >
              {submit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Star className="mr-2 size-4" />}
              {accessToken ? "Envoyer ma note" : "Connectez-vous pour noter"}
            </Button>
            {submit.error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {(submit.error as Error).message}
              </p>
            )}
          </>
        )}

        {/* Sample reviews */}
        {(tripReviews.data?.items.length ?? 0) > 0 && target === "trip" && (
          <div className="border-t pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Avis récents</p>
            <ul className="mt-2 space-y-2">
              {tripReviews.data!.items.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-lg bg-muted/30 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {r.author.firstName ?? "?"} {r.author.lastName?.[0] ?? ""}.
                    </span>
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Star className="size-3 fill-amber-500 text-amber-500" /> {r.rating}/5
                    </Badge>
                  </div>
                  {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}