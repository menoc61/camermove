"use client";

/**
 * Static (non-fetched) panels for the dashboard tabs:
 *   - "favorites" — wired favorites list with remove + pagination
 *   - "support"   — three contact tiles (chat / tel / WhatsApp)
 *
 * Extracted from DashboardTabs.tsx so the orchestrator stays under 250 lines
 * (AGENTS.md §4: "any file >300 lines is a split candidate").
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "../cards/EmptyState";
import { PaginationControls } from "../controls/PaginationControls";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFavorites, removeFavorite } from "@/lib/api/favorites";

export function FavoritesPanel({ token }: { token: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const favs = useQuery({
    queryKey: ["dashboard-favorites", token, page],
    queryFn: () => fetchFavorites(token, page, 20),
    placeholderData: (prev) => prev,
  });
  const items = favs.data?.items ?? [];
  if (favs.isFetching && items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (items.length === 0 && favs.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Impossible de charger les favoris.
      </p>
    );
  }
  if (items.length === 0 && !favs.isError) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Vos destinations, agences et trajets favoris apparaîtront ici. Marquez-les depuis la
          barre de recherche.
        </p>
        <EmptyState
          title="Aucun favori pour le moment"
          description="Vos destinations, agences et trajets favoris apparaîtront ici."
          cta={{
            label: "Explorer les destinations",
            href: "/results?origin=Yaound%C3%A9&destination=Douala&pax=1",
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {removeError ? <p role="alert" className="text-xs text-destructive">{removeError}</p> : null}
      {items.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{f.kind} · {f.entityId.slice(0, 8)}</p>
            <p className="text-[11px] text-muted-foreground">
              Ajouté le {new Date(f.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            disabled={pendingId === f.id}
            onClick={async () => {
              setPendingId(f.id);
              setRemoveError(null);
              try {
                await removeFavorite(token, f.id);
                qc.invalidateQueries({ queryKey: ["dashboard-favorites"] });
              } catch {
                setRemoveError("Retrait impossible");
              } finally {
                setPendingId(null);
              }
            }}
          >
            {pendingId === f.id ? "…" : "Retirer"}
          </button>
        </div>
      ))}
      <PaginationControls
        page={favs.data?.page ?? page}
        totalPages={favs.data?.totalPages ?? 1}
        isFetching={favs.isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}

export function SupportPanel() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Notre équipe est disponible 7j/7 de 7h à 22h (heure de Douala).
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <SupportTile title="Chat en direct" desc="Réponse en moins de 5 minutes" href="/contact" />
        <SupportTile title="Téléphone" desc="+237 6 99 00 00 00" href="tel:+237699000000" />
        <SupportTile title="WhatsApp" desc="Réponse rapide en français/anglais" href="https://wa.me/237699000000" />
      </div>
    </div>
  );
}

function SupportTile({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </a>
  );
}
