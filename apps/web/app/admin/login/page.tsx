import type { Metadata } from "next"
import { AdminLoginForm } from "../../../components/admin/AdminLoginForm"

export const metadata: Metadata = {
  title: "Console d'administration",
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-black/30">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[4px] bg-primary" aria-hidden />
          <span className="text-lg font-bold tracking-tight text-white">CamerMove</span>
          <span className="ml-auto rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Admin
          </span>
        </div>
        <AdminLoginForm next={next} />
      </div>
    </main>
  )
}
