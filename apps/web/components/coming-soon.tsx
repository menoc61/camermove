import Link from "next/link"
import { Construction, ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ComingSoonPageProps {
  title: string
  description: string
  serviceName: string
}

export default function ComingSoonPage({ title, description, serviceName }: ComingSoonPageProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 rounded-full bg-accent p-4">
        <Construction className="size-10 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{description}</p>
      <p className="mt-2 text-sm font-medium text-primary">Service {serviceName}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
          <ArrowLeft className="mr-2 size-4" />
          Retour à l'accueil
        </Link>
        <Link href="/results" className={cn(buttonVariants({ variant: "default" }), "rounded-full")}>
          Réserver un bus
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Ce service sera bientôt disponible. Le transport interurbain est notre service principal.
      </p>
    </main>
  )
}
