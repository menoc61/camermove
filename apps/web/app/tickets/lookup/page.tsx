/**
 * /tickets/lookup — PUBLIC RSC page. No auth, no client JS. Renders a
 * minimal server-rendered HTML view of a ticket by its reference, calling
 * the public /api/v1/tickets/lookup endpoint.
 *
 * IMPORTANT: The rendered HTML must never include verificationCode, email,
 * phone, idNumber. The API response is already sanitized (see
 * apps/api/src/routes/tickets/lookup.ts). This page just renders what it
 * receives; we also avoid deriving those fields from any other source.
 */
import Link from "next/link"

interface LookupResponse {
  reference: string
  tripOrigin: string
  tripDestination: string
  departureAt: string
  status: string
  passengerFirstName: string
}

async function fetchLookup(ref: string): Promise<{ status: number; body: LookupResponse | null }> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  try {
    const res = await fetch(`${base}/api/v1/tickets/lookup?ref=${encodeURIComponent(ref)}`, {
      cache: "no-store",
    })
    if (!res.ok) return { status: res.status, body: null }
    return { status: res.status, body: (await res.json()) as LookupResponse }
  } catch {
    return { status: 500, body: null }
  }
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

const STATUS_LABEL: Record<string, string> = {
  valid: "Valide",
  used: "Utilisé",
  void: "Annulé",
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const sp = await searchParams
  const ref = sp.ref?.trim() ?? ""

  if (!ref) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Vérification de billet</h1>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Référence manquante.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-[#0e9f8f]">
            Aller au tableau de bord
          </Link>
        </div>
      </main>
    )
  }

  const { status, body } = await fetchLookup(ref)

  if (status === 200 && body) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Vérification de billet</h1>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-mono text-center text-2xl font-semibold text-slate-900">
            {body.reference}
          </p>
          <p className="mt-2 text-center text-base font-semibold text-slate-900">
            {body.tripOrigin} → {body.tripDestination}
          </p>
          <p className="mt-1 text-center text-sm text-slate-500">{fmtDate(body.departureAt)}</p>
          <p className="mt-4 text-center text-xs text-slate-500">
            Statut :{" "}
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-mono text-emerald-700">
              {STATUS_LABEL[body.status] ?? body.status}
            </span>
          </p>
          {body.passengerFirstName ? (
            <p className="mt-4 text-center text-sm text-slate-700">
              Au nom de <span className="font-semibold">{body.passengerFirstName}</span>
            </p>
          ) : null}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Cette page affiche uniquement les informations publiques du billet.
        </p>
      </main>
    )
  }

  if (status === 410) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Vérification de billet</h1>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">Ce trajet est expiré.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-[#0e9f8f]">
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    )
  }

  if (status === 404) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Vérification de billet</h1>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">Billet introuvable.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-[#0e9f8f]">
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Vérification de billet</h1>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">Erreur de vérification.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-[#0e9f8f]">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  )
}
