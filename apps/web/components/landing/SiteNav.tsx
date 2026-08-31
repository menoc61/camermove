import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
          <a href="#agences" className="transition-colors hover:text-slate-900">
            Agences
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
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-full border-primary-dark text-primary-dark"
          )}
        >
          Se connecter
        </Link>
      </nav>
    </header>
  )
}
