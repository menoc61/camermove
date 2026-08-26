import type { Metadata } from "next"
import { AuthForm } from "../../components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Créez votre compte CamerMove pour réserver vos billets de bus Yaoundé–Douala et retrouver vos e-billets.",
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tighter text-slate-900">Créer un compte</h1>
      <AuthForm mode="register" next={next} />
    </main>
  )
}
