import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function PartnerCta() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--brand-dark)), hsl(var(--brand)))`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative mx-auto flex max-w-[640px] flex-col items-center px-4 py-16 text-center sm:px-6">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-white md:text-4xl">
          Vous exploitez des bus au Cameroun&nbsp;?
        </h2>
        <p className="mt-4 max-w-[50ch] text-sm leading-relaxed text-white/85">
          Publiez vos trajets, remplissez vos sièges et encaissez en toute confiance.
          L&apos;inscription partenaire prend moins de dix minutes.
        </p>
        <Link
          href="/transporter/apply"
          className={cn(
            "mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-bold text-ink-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          )}
        >
          Devenir partenaire
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
