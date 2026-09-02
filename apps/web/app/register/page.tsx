import type { Metadata } from "next"
import { AuthForm } from "../../components/auth/AuthForm"
import { AnimatedAuthWrapper } from "../../components/auth/AnimatedAuthWrapper"

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
    <AnimatedAuthWrapper
      title="Créer un compte"
      subtitle="Réservez Yaoundé–Douala en 2 minutes, e-billet QR inclus"
    >
      <AuthForm mode="register" next={next} />
    </AnimatedAuthWrapper>
  )
}
