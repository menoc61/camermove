import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    const res = await fetch(`${base}/api/v1/tickets/lookup?ref=${encodeURIComponent(ref)}`, { cache: "no-store" })
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

const STATUS_LABEL: Record<string, string> = { valid: "Valide", used: "Utilisé", void: "Annulé" }

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const sp = await searchParams
  const ref = sp.ref?.trim() ?? ""

  if (!ref) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Vérification de billet</h1>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Référence manquante.</p>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "link" }), "mt-3")}>
              Aller au tableau de bord
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { status, body } = await fetchLookup(ref)

  if (status === 200 && body) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Vérification de billet</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="font-mono text-2xl font-semibold">{body.reference}</p>
            <p className="text-base font-semibold">
              {body.tripOrigin} → {body.tripDestination}
            </p>
            <p className="text-sm text-muted-foreground">{fmtDate(body.departureAt)}</p>
            <Badge variant="secondary" className="mt-2">
              {STATUS_LABEL[body.status] ?? body.status}
            </Badge>
            {body.passengerFirstName ? (
              <p className="mt-2 text-sm">
                Au nom de <span className="font-semibold">{body.passengerFirstName}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Cette page affiche uniquement les informations publiques du billet.</p>
      </main>
    )
  }

  const messages: Record<number, string> = { 410: "Ce trajet est expiré.", 404: "Billet introuvable." }
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Vérification de billet</h1>
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm">{messages[status] ?? "Erreur de vérification."}</p>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "link" }), "mt-3")}>
            Retour au tableau de bord
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
