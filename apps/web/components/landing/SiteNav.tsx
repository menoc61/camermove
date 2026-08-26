import Link from "next/link"

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="CamerMove — accueil">
          <span className="inline-block h-3 w-3 rounded-[4px] bg-primary" aria-hidden />
          <span className="text-lg font-bold tracking-tight text-slate-900">CamerMove</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#etapes" className="transition-colors hover:text-slate-900">
            Comment ça marche
          </a>
          <a href="#departures" className="transition-colors hover:text-slate-900">
            Prochains départs
          </a>
          <Link href="/transporter/apply" className="transition-colors hover:text-slate-900">
            Devenir partenaire
          </Link>
        </div>

        <Link
          href="/login"
          className="rounded-full border border-primary-dark px-4 py-1.5 text-sm font-semibold text-primary-dark transition-transform hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        >
          Se connecter
        </Link>
      </nav>
    </header>
  )
}
