/**
 * TicketDetail — full ticket view: QR PNG (data URL), verification code,
 * trip info, passenger list. QR scales on small viewports via max-w-[240px].
 * All copy in French per UI-SPEC.
 */
import Link from "next/link"
import type { TicketDetailResponse } from "../../lib/api/tickets"
import { StatusPill, mapTicketStatus } from "../dashboard/StatusPill"

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
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">Réf. {data.reference}</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Votre billet</h1>
        </div>
        <StatusPill kind={mapTicketStatus(data.status)} />
      </header>

      {/* QR card — data URL, scales to viewport via max-w-[240px] */}
      <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
        {data.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.qrDataUrl}
            alt="QR code du billet"
            className="mx-auto h-auto max-w-[240px]"
          />
        ) : (
          <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center rounded bg-slate-100 text-xs text-slate-500">
            QR indisponible
          </div>
        )}
        <p className="mt-4 font-mono text-center text-lg text-slate-900">
          {data.verificationCode}
        </p>
        <p className="mt-1 text-xs text-slate-500">Code de vérification</p>
      </section>

      {/* Trip info */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Trajet</h2>
        <p className="text-base font-semibold text-slate-900">
          {data.trip.origin} → {data.trip.destination}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
          <dt>Départ</dt>
          <dd className="text-right text-slate-900">{fmtDate(data.trip.departureAt)}</dd>
          <dt>Arrivée estimée</dt>
          <dd className="text-right text-slate-900">{fmtDate(data.trip.arrivalAt)}</dd>
          <dt>Véhicule</dt>
          <dd className="text-right text-slate-900">{data.trip.vehiclePlate ?? "—"}</dd>
          <dt>Sièges</dt>
          <dd className="text-right text-slate-900">{data.trip.seatCount}</dd>
        </dl>
      </section>

      {/* Passengers */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Passagers</h2>
        <ul className="space-y-2">
          {data.passengers.map((p, i) => (
            <li
              key={`${p.seatNumber}-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-900">
                {p.firstName} {p.lastName}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                Siège {p.seatNumber}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/dashboard"
        className="block w-full rounded-lg bg-[#0e9f8f] py-2 text-center text-sm font-medium text-white"
      >
        Voir mes voyages
      </Link>
    </div>
  )
}
