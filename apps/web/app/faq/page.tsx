import type { Metadata } from "next"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { FAQS } from "@/lib/data/faq"

export const metadata: Metadata = {
  title: "FAQ — CamerMove",
  description: "Questions fréquentes sur CamerMove : réservation, paiement, billets, annulation.",
}

export default function FaqPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tighter">FAQ</h1>
        <p className="mt-2 text-muted-foreground">Tout ce que vous devez savoir.</p>
        <div className="mt-8 divide-y rounded-2xl border">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5 open:bg-muted/20">
              <summary className="cursor-pointer list-none font-medium flex justify-between gap-4">
                <span>{f.q}</span>
                <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
