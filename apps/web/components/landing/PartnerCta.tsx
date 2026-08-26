import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function PartnerCta() {
  return (
    <section className="bg-primary-dark">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Vous exploitez des bus au Cameroun&nbsp;?
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-white/85">
            Publiez vos trajets, remplissez vos sièges et encaissez en toute confiance.
            L'inscription partenaire prend moins de dix minutes.
          </p>
        </div>
        <Link
          href="/transporter/apply"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        >
          Devenir partenaire
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
