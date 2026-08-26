import type { Metadata } from "next"
import { AuthForm } from "../../components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tighter text-slate-900">Connexion</h1>
      <AuthForm mode="login" next={next} />
    </main>
  )
}
