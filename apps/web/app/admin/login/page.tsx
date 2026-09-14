import type { Metadata } from "next"
import { AdminLoginForm } from "../../../components/admin/AdminLoginForm"

export const metadata: Metadata = {
  title: "Console d'administration",
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

/* Split-screen admin gate, on the site's Swiss ink/paper system:
   left — brand panel on ink with hairline grid + wood accent;
   right — the form on paper. Sharp corners by design (radius = 0). */
export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  return (
    <main className="grid min-h-[100dvh] grid-cols-1 bg-paper text-ink lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink text-paper lg:flex">
        {/* Hairline grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #F5F4F1 1px, transparent 1px), linear-gradient(to bottom, #F5F4F1 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="relative flex items-center gap-2 px-12 py-10">
          <span className="inline-block h-3 w-3 bg-paper" aria-hidden />
          <span className="text-lg font-bold tracking-tight">CamerMove</span>
        </div>
        <div className="relative px-12 pb-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            Console interne
          </p>
          <p className="mt-6 max-w-[22ch] font-body text-[clamp(2rem,3.4vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.03em] text-balance">
            Piloter la mobilité,
            <br />
            <span className="text-white/55">chiffre par chiffre.</span>
          </p>
          <div className="mt-10 flex items-center gap-4 text-[11px] uppercase tracking-[0.22em] text-white/45">
            <span className="block h-px w-12 bg-wood" aria-hidden />
            <span>Utilisateurs · Trajets · Paiements · Conformité</span>
          </div>
        </div>
        <p className="relative px-12 pb-10 text-[11px] uppercase tracking-[0.22em] text-white/35">
          Accès surveillé · Authentification requise
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="inline-block h-3 w-3 bg-ink" aria-hidden />
            <span className="text-lg font-bold tracking-tight">CamerMove</span>
            <span className="ml-auto border border-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-2">
              Admin
            </span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
            Connexion
          </p>
          <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.025em]">
            Console d&apos;administration
          </h1>
          <div className="mt-2 border-t border-line" aria-hidden />
          <div className="mt-8">
            <AdminLoginForm next={next} />
          </div>
        </div>
      </div>
    </main>
  )
}
