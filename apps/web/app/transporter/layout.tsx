import Link from "next/link"

const nav = [
  { href: "/transporter/dashboard", label: "Tableau de bord" },
  { href: "/transporter/vehicles", label: "Véhicules" },
  { href: "/transporter/routes", label: "Itinéraires" },
  { href: "/transporter/trips", label: "Trajets" },
  { href: "/transporter/bookings", label: "Réservations" },
  { href: "/transporter/apply", label: "Candidature" },
]

export default function TransporterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav className="mb-6 flex flex-wrap gap-2">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium hover:bg-accent">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
