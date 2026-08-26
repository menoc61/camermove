import Link from "next/link"
import type { TicketDetailResponse } from "../../lib/api/tickets"
import { StatusPill, mapTicketStatus } from "../dashboard/StatusPill"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function TicketDetail({ data }: { data: TicketDetailResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">Réf. {data.reference}</span>
          <h1 className="text-xl font-semibold tracking-tight">Votre billet</h1>
        </div>
        <StatusPill kind={mapTicketStatus(data.status)} />
      </header>

      <Card>
        <CardContent className="flex flex-col items-center p-6 text-center">
          {data.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.qrDataUrl} alt="QR code du billet" className="mx-auto h-auto max-w-[240px]" />
          ) : (
            <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center rounded-lg border border-dashed bg-muted text-xs text-muted-foreground">
              QR indisponible
            </div>
          )}
          <p className="mt-4 font-mono text-lg font-semibold">{data.verificationCode}</p>
          <p className="text-xs text-muted-foreground">Code de vérification</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trajet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-base font-semibold">
            {data.trip.origin} → {data.trip.destination}
          </p>
          <Separator />
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Départ</dt>
            <dd className="text-right font-medium">{fmtDate(data.trip.departureAt)}</dd>
            <dt className="text-muted-foreground">Arrivée estimée</dt>
            <dd className="text-right font-medium">{fmtDate(data.trip.arrivalAt)}</dd>
            <dt className="text-muted-foreground">Véhicule</dt>
            <dd className="text-right font-medium">{data.trip.vehiclePlate ?? "—"}</dd>
            <dt className="text-muted-foreground">Sièges</dt>
            <dd className="text-right font-medium">{data.trip.seatCount}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Passagers</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {data.passengers.map((p, i) => (
              <li key={`${p.seatNumber}-${i}`} className="flex items-center justify-between text-sm">
                <span>
                  {p.firstName} {p.lastName}
                </span>
                <Badge variant="secondary" className="font-mono text-xs">
                  Siège {p.seatNumber}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Link href="/dashboard" className={cn(buttonVariants(), "w-full rounded-full")}>
        Voir mes voyages
      </Link>
    </div>
  )
}
