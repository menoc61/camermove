import Image from "next/image"
import { QrCode, ShieldCheck, Wallet } from "lucide-react"
import { SearchBar } from "../search/search-bar"
import { Badge } from "@/components/ui/badge"

const trust = [
  { icon: ShieldCheck, label: "Paiement Mobile Money sÃ©curisÃ©" },
  { icon: QrCode, label: "E-billet QR immÃ©diat" },
  { icon: Wallet, label: "Meilleurs prix du jour" },
]

export function Hero({ minPrice }: { minPrice?: number }) {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-dark">
            YaoundÃ© â‡„ Douala Â· quotidien
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tighter text-slate-900 md:text-6xl">
            Le bus YaoundÃ©â€“Douala, rÃ©servÃ© en deux minutes.
          </h1>
          <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-slate-600 md:text-lg">
            Comparez les dÃ©parts du jour, payez par Mobile Money et recevez votre e-billet
            QR immÃ©diatement.
          </p>

          <div className="relative z-10 mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 sm:p-5">
            <SearchBar />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-slate-600">
                <Icon className="h-4 w-4 text-primary-dark" strokeWidth={1.75} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:col-span-6 lg:block">
          <div className="relative ml-auto aspect-[4/5] w-[78%] overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10">
            <Image
              src="https://picsum.photos/seed/camermove-route/900/1100"
              alt="Route interurbaine au Cameroun"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 0vw"
              className="object-cover"
            />
            {minPrice != null && (
              <Badge className="absolute left-4 top-4 bg-secondary font-bold text-secondary-foreground">
                À partir de {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF
              </Badge>
            )}
          </div>
          <div className="absolute -bottom-6 left-0 aspect-[16/10] w-[46%] rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white shadow-lg shadow-slate-900/15">
            <Image
              src="https://picsum.photos/seed/camermove-douala/720/450"
              alt="DÃ©part de bus Ã  Douala"
              fill
              sizes="(min-width: 1024px) 24vw, 0vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
