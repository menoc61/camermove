"use client";

/**
 * Static (non-fetched) panels for the dashboard tabs:
 *   - "favorites" — empty-state with a discover CTA
 *   - "support"   — three contact tiles (chat / tel / WhatsApp)
 *
 * Extracted from DashboardTabs.tsx so the orchestrator stays under 250 lines
 * (AGENTS.md §4: "any file >300 lines is a split candidate").
 */
import { EmptyState } from "../cards/EmptyState";

export function FavoritesPanel() {
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