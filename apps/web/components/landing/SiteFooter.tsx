import Link from "next/link"
import { NewsletterForm } from "@/components/landing/NewsletterForm"

const services = [
  { label: "Transport interurbain", href: "/results?origin=Yaound%C3%A9&destination=Douala&pax=1" },
  { label: "Hôtels & appartements", href: "/hotels" },
  { label: "Location de véhicules", href: "/rentals" },
  { label: "Transport de colis", href: "/parcels" },
  { label: "Assurance voyage", href: "/insurance" },
  { label: "Billetterie événements", href: "/events" },
]

const voyageurs = [
  { label: "Mes réservations", href: "/dashboard" },
  { label: "Retrouver un billet", href: "/tickets/lookup" },
  { label: "Comment ça marche", href: "/#etapes" },
  { label: "FAQ", href: "/faq" },
]

const partenaires = [
  { label: "Devenir partenaire", href: "/transporter/apply" },
  { label: "Espace partenaire", href: "/transporter" },
  { label: "Contact", href: "mailto:contact@camermove.cm" },
]

const legal = [
  { label: "Conditions générales", href: "/legal/cgu" },
  { label: "Confidentialité", href: "/legal/privacy" },
  { label: "Mentions légales", href: "/legal/terms" },
]

const columns = [
  { title: "Services", links: services },
  { title: "Voyageurs", links: voyageurs },
  { title: "Partenaires", links: partenaires },
  { title: "Légal", links: legal },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink text-paper">
      {/* Newsletter band */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-8 px-6 py-12 sm:px-8 md:flex-row md:items-end md:justify-between md:px-12 md:py-16">
          <div className="max-w-[44ch]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Newsletter
            </p>
            <h2 className="mt-3 text-[clamp(1.6rem,2.6vw,2.2rem)] font-medium leading-[1.05] tracking-[-0.02em] text-paper text-balance">
              Nouveaux trajets, partenaires et coulisses — une fois par mois.
            </h2>
          </div>
          <NewsletterForm />
        </div>
      </div>

      {/* Big wordmark — Swiss-style watermark */}
      <div className="overflow-hidden border-b border-white/10">
        <p
          aria-hidden
          className="select-none whitespace-nowrap text-center font-body font-medium leading-none tracking-[-0.06em] text-paper/[0.06]"
          style={{ fontSize: "clamp(7rem, 22vw, 22rem)" }}
        >
          CamerMove
        </p>
      </div>

      {/* Link grid */}
      <div className="mx-auto grid max-w-[1560px] grid-cols-2 gap-x-6 gap-y-12 px-6 py-16 sm:px-8 md:grid-cols-12 md:px-12 md:py-20">
        <div className="col-span-2 md:col-span-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
            Studio · 2026
          </p>
          <p className="mt-3 text-[15px] leading-[1.55] text-white/65">
            Plateforme multi-services dédiée à la mobilité, au voyage et aux
            services associés au Cameroun. Transport interurbain, hôtels,
            location, colis, assurance, événements.
          </p>
          <div className="mt-6 flex items-center gap-3 text-white/55">
            {[
              { label: "Facebook", href: "https://facebook.com/camermove" },
              { label: "Twitter", href: "https://x.com/camermove" },
              { label: "Instagram", href: "https://instagram.com/camermove" },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/70 transition-colors hover:border-paper hover:text-paper"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {columns.map((g) => (
          <nav
            key={g.title}
            aria-label={g.title}
            className="col-span-1 md:col-span-2"
          >
            <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
              {g.title}
            </h3>
            <ul className="mt-5 flex flex-col gap-3 text-[14px]">
              {g.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("http") || l.href.startsWith("mailto:") ? (
                    <a
                      href={l.href}
                      className="text-white/70 transition-colors hover:text-paper"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-white/70 transition-colors hover:text-paper"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Baseline */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-[11px] uppercase tracking-[0.22em] text-white/45 sm:px-8 md:px-12">
          <span>© 2026 CamerMove — Tous droits réservés</span>
          <span>Yaoundé · Douala · Cameroun</span>
          <span>v1.1 · MVP</span>
        </div>
      </div>
    </footer>
  )
}
