import type { Metadata } from "next"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { ContactForm } from "@/components/contact/ContactForm"

export const metadata: Metadata = {
  title: "Contact — CamerMove",
  description: "Contactez CamerMove pour toute question.",
}

export default function ContactPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tighter">Contact</h1>
        <p className="mt-2 text-muted-foreground">Une question ? Écrivez-nous — réponse sous 24h.</p>
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <ContactForm />
        </div>
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Email : <a href="mailto:contact@camermove.cm" className="underline">contact@camermove.cm</a></p>
          <p className="mt-1">Yaoundé · Douala · Cameroun</p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
