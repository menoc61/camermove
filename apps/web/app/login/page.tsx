import type { Metadata } from "next"
import Link from "next/link"
import { AuthForm } from "../../components/auth/AuthForm"
import { AnimatedAuthWrapper } from "../../components/auth/AnimatedAuthWrapper"

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
}

type Role = "voyageur" | "partenaire" | "admin"

const ROLE_LABELS: Record<Role, { label: string; hint: string }> = {
  voyageur: { label: "Voyageur", hint: "Réservations, billets, paiements" },
  partenaire: { label: "Partenaire", hint: "Devenir transporteur ou hôte" },
  admin: { label: "Administration", hint: "Console CamerMove" },
}

function isRole(v: string | undefined): v is Role {
  return v === "voyageur" || v === "partenaire" || v === "admin"
}

interface PageProps {
  searchParams: Promise<{ next?: string; role?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, role: rawRole } = await searchParams
  const role: Role = isRole(rawRole) ? rawRole : "voyageur"

  return (
    <AnimatedAuthWrapper
      title="Connexion"
      subtitle="Choisissez votre type de compte pour continuer"
    >
      <nav
        aria-label="Type de compte"
        className="mb-6 flex w-full rounded-full border border-border bg-surface-1 p-1"
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
          const active = r === role
          const href = r === "voyageur" ? "/login" : `/login?role=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`
          return (
            <Link
              key={r}
              href={href}
              className={
                "flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors " +
                (active
                  ? "bg-ink text-paper shadow-xs"
                  : "text-ink-2 hover:text-ink")
              }
              aria-current={active ? "page" : undefined}
            >
              {ROLE_LABELS[r].label}
            </Link>
          )
        })}
      </nav>

      {role === "voyageur" && (
        <AuthForm mode="login" next={next} />
      )}

      {role === "partenaire" && (
        <div className="space-y-4 text-sm text-ink-1">
          <p className="leading-[1.55]">
            L'espace partenaire est en cours d'intégration. Pour proposer des trajets,
            des hébergements, des véhicules, des colis, des assurances ou des
            événements, candidatez maintenant — l'équipe CamerMove vous recontacte
            sous 48 h.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/transporter/apply"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-1"
            >
              Devenir partenaire
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold hover:bg-surface-1"
            >
              Contacter l'équipe
            </Link>
          </div>
          <p className="text-xs text-ink-2">
            Vous êtes déjà partenaire ? La connexion à votre tableau de bord
            arrive bientôt.
          </p>
        </div>
      )}

      {role === "admin" && (
        <div className="space-y-4 text-sm text-ink-1">
          <p className="leading-[1.55]">
            La console d'administration est séparée du compte voyageur pour des
            raisons de sécurité. Connectez-vous avec vos identifiants d'équipe.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-1"
          >
            Ouvrir la console d'administration
          </Link>
          <p className="text-xs text-ink-2">
            Accès réservé aux super-admins et admins CamerMove. Toute tentative
            d'accès non autorisé est journalisée.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink-2">
        Pas encore de compte ?{" "}
        <Link
          href={role === "voyageur" ? "/register" : `/login?role=voyageur&next=${encodeURIComponent("/register")}`}
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          Créer un compte voyageur
        </Link>
      </p>
    </AnimatedAuthWrapper>
  )
}
