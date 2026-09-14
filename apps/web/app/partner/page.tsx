import Link from "next/link"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPartnerServices, type PartnerService } from "../../lib/api/partners"
import { ApiError } from "../../lib/api/client"

export const metadata = { title: "Espace Partenaire — CamerMove" }

const fmtXaf = (amount: number) => new Intl.NumberFormat("fr-CM").format(amount)

function KpiGrid({ service }: { service: PartnerService }) {
  const k = service.kpis
  const cells: Array<{ label: string; value: string }> = [
    { label: service.service === "parcels" ? "Colis traités" : service.service === "transporter" ? "Trajets publiés" : "Établissements", value: String(k.entities) },
  ]
  if (k.bookings !== undefined) cells.push({ label: service.service === "parcels" ? "Total colis" : "Réservations", value: String(k.bookings) })
  if (k.revenue !== undefined) cells.push({ label: "Revenu confirmé (XAF)", value: fmtXaf(k.revenue) })
  if (k.activeTrips !== undefined) cells.push({ label: "Trajets actifs", value: String(k.activeTrips) })
  if (k.parcelsInTransit !== undefined) cells.push({ label: "En cours", value: String(k.parcelsInTransit) })
  if (k.parcelsDelivered !== undefined) cells.push({ label: "Livrés", value: String(k.parcelsDelivered) })
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-lg font-semibold">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

export default async function PartnerHomePage() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/partner")

  let data
  try {
    data = await getPartnerServices(token)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/partner")
    data = { services: [], application: null }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Espace Partenaire</h1>
        <p className="text-sm text-muted-foreground">
          Vos services partenaires et leurs indicateurs. Vous ne voyez ici que les services sur lesquels vous êtes partenaire.
        </p>
      </div>

      {data.application ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Candidature — {data.application.companyName}
              <Badge variant={data.application.status === "validated" || data.application.status === "approved" ? "default" : "secondary"}>
                {data.application.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {data.application.status === "validated" || data.application.status === "approved"
                ? "Votre candidature est validée. Vos services apparaissent ci-dessous dès que vous publiez une offre."
                : data.application.status === "rejected"
                  ? "Votre candidature a été refusée. Contactez le support pour plus de détails."
                  : "Votre candidature est en cours d'examen. Vous aurez accès aux services partenaires après validation."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {data.services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              Vous n&apos;êtes partenaire d&apos;aucun service pour le moment.
            </p>
            <Link href="/become-partner">
              <Button>Devenir partenaire</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.services.map((s) => (
            <Card key={s.service}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {s.label}
                  <Link href={s.href}>
                    <Button variant="outline" size="sm">Gérer</Button>
                  </Link>
                </CardTitle>
                <CardDescription>KPIs de vos offres sur ce service</CardDescription>
              </CardHeader>
              <CardContent>
                <KpiGrid service={s} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
