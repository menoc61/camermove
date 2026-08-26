import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PartnerCta() {
  return (
    <section className="bg-primary-dark">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Vous exploitez des bus au Cameroun&nbsp;?
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-white/85">
            Publiez vos trajets, remplissez vos siÃ¨ges et encaissez en toute confiance.
            L'inscription partenaire prend moins de dix minutes.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="shrink-0 rounded-full bg-secondary font-bold text-secondary-foreground hover:bg-secondary/90"
        >
          <Link href="/transporter/apply">
            Devenir partenaire
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}
