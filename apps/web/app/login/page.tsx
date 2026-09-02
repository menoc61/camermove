import type { Metadata } from "next"
import { AuthForm } from "../../components/auth/AuthForm"
import { AnimatedAuthWrapper } from "../../components/auth/AnimatedAuthWrapper"

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
    <AnimatedAuthWrapper
      title="Connexion"
      subtitle="Accédez à vos voyages et e-billets CamerMove"
    >
      <AuthForm mode="login" next={next} />
    </AnimatedAuthWrapper>
  )
}
