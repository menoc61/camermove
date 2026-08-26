import Link from "next/link"

const groups = [
  {
    title: "Voyageurs",
    links: [
      { label: "Rechercher un trajet", href: "/results?origin=Yaound%C3%A9&destination=Douala&pax=1" },
      { label: "Mon compte", href: "/dashboard" },
      { label: "Retrouver un billet", href: "/tickets/lookup" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "Devenir partenaire", href: "/transporter/apply" },
      { label: "Contact", href: "mailto:contact@camermove.cm" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions générales", href: "#" },
      { label: "Confidentialité", href: "#" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-[4px] bg-primary" aria-hidden />
            <span className="text-lg font-bold tracking-tight text-white">CamerMove</span>
          </div>
          <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-slate-400">
            La façon simple de réserver vos trajets interurbains au Cameroun.
          </p>
        </div>

        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{g.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {g.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("http") || l.href.startsWith("mailto:") ? (
                    <a href={l.href} className="transition-colors hover:text-white">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <span>© 2026 CamerMove. Tous droits réservés.</span>
          <span>Yaoundé · Douala · Cameroun</span>
        </div>
      </div>
    </footer>
  )
}
