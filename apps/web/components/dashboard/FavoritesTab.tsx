"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Car, Hotel, Ticket, X } from "lucide-react"
import { fetchFavorites, removeFavorite, type Favorite, type FavoriteKind } from "../../lib/api/favorites"
import { EmptyState } from "./EmptyState"
import { SkeletonCard } from "./SkeletonCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const KIND_META: Record<FavoriteKind, { label: string; href: (entityId: string) => string; Icon: typeof Hotel }> = {
  hotel: { label: "Hôtel", href: (id) => `/hotels/${id}`, Icon: Hotel },
  rental: { label: "Location", href: (id) => `/rentals/${id}`, Icon: Car },
  event: { label: "Événement", href: (id) => `/events/${id}`, Icon: Ticket },
}

function FavoriteCard({ item, token }: { item: Favorite; token: string }) {
  const queryClient = useQueryClient()
  const meta = KIND_META[item.kind] ?? KIND_META.hotel
  const { Icon } = meta
  const remove = useMutation({
    mutationFn: () => removeFavorite(token, item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-favorites", token] }),
  })
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            {meta.label}
          </span>
          <Badge variant="secondary">{item.kind}</Badge>
        </div>
        <p className="text-xs font-mono text-muted-foreground">{item.entityId}</p>
        <div className="flex items-center justify-between">
          <Link href={meta.href(item.entityId)} className="text-sm underline underline-offset-4">
            Voir
          </Link>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            aria-label="Retirer des favoris"
          >
            <X className="h-4 w-4" aria-hidden />
            {remove.isPending ? "…" : "Retirer"}
          </Button>
        </div>
        {remove.isError ? <p className="text-xs text-destructive">Suppression impossible. Réessayez.</p> : null}
      </CardContent>
    </Card>
  )
}

export function FavoritesTab({ token }: { token: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-favorites", token],
    queryFn: () => fetchFavorites(token),
  })
  const items = data?.items ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Erreur</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          Impossible de charger vos favoris. Réessayez.
          <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">
            Réessayer
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (items.length === 0) {
    return <EmptyState title="Aucun favori pour le moment" cta={{ href: "/hotels", label: "Découvrir" }} />
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FavoriteCard key={item.id} item={item} token={token} />
      ))}
    </div>
  )
}
