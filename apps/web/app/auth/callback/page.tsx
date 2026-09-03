"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@camermove/frontend"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function CallbackInner() {
  const router = useRouter()
  const search = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const accessToken = search.get("accessToken")
    const refreshToken = search.get("refreshToken")
    const userRaw = search.get("user")
    const err = search.get("error")

    if (err) {
      setError(err)
      return
    }

    if (accessToken && refreshToken) {
      try {
        const user = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : { id: "google", email: "", role: "traveler" }
        setAuth({ accessToken, user })
        const next = search.get("next")
        router.replace(next && next.startsWith("/") ? next : "/dashboard")
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }

    setError("Callback incomplet — veuillez réessayer.")
  }, [search, setAuth, router])

  if (error) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Échec de connexion</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Retour à la connexion</a>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">Finalisation de la connexion…</p>
        </CardContent>
      </Card>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <CallbackInner />
    </Suspense>
  )
}
