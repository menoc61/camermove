"use client";

/**
 * Static column / empty-state definitions used by DashboardTabs.
 *
 * Kept in a sibling module so the orchestrating component stays under 250 lines
 * (AGENTS.md §4: "any file >300 lines is a split candidate").
 */
import type { Column } from "../panels/DataTable";

export const GENERIC_COLUMNS: Record<string, Column[]> = {
  trips: [
    { key: "reference", label: "Référence" },
    { key: "origin", label: "Origine" },
    { key: "destination", label: "Destination" },
    {
      key: "departureAt",
      label: "Départ",
      render: (v: unknown) =>
        v ? new Date(String(v)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—",
    },
    {
      key: "totalAmount",
      label: "Montant",
      render: (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    },
    { key: "status", label: "Statut" },
  ],
  hotels: [
    {
      key: "hotel",
      label: "Hôtel",
      render: (v: unknown) => {
        const obj = v && typeof v === "object" ? (v as { name?: string }) : null;
        return <span className="font-medium">{obj?.name ?? "—"}</span>;
      },
    },
    {
      key: "checkInDate",
      label: "Arrivée",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    {
      key: "checkOutDate",
      label: "Départ",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    {
      key: "totalAmount",
      label: "Montant",
      render: (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    },
    { key: "status", label: "Statut" },
  ],
  rentals: [
    {
      key: "vehicle",
      label: "Véhicule",
      render: (v: unknown) => {
        const obj = v && typeof v === "object" ? (v as { name?: string }) : null;
        return <span className="font-medium">{obj?.name ?? "—"}</span>;
      },
    },
    {
      key: "startDate",
      label: "Début",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    {
      key: "endDate",
      label: "Fin",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    {
      key: "totalAmount",
      label: "Montant",
      render: (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    },
    { key: "status", label: "Statut" },
  ],
  parcels: [
    {
      key: "trackingNumber",
      label: "Suivi",
      render: (v: unknown, row: Record<string, unknown>) => (
        <a href={`/parcels/track/${String(v)}`} className="font-mono underline underline-offset-4">
          {String(v ?? row.id ?? "—")}
        </a>
      ),
    },
    { key: "recipientName", label: "Destinataire" },
    {
      key: "createdAt",
      label: "Envoyé le",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    { key: "status", label: "Statut" },
  ],
  insurance: [
    { key: "policyNumber", label: "Police" },
    {
      key: "startDate",
      label: "Début",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    {
      key: "endDate",
      label: "Fin",
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"),
    },
    { key: "status", label: "Statut" },
  ],
  events: [
    { key: "reference", label: "Référence" },
    {
      key: "event",
      label: "Événement",
      render: (v: unknown) => {
        const obj = v && typeof v === "object" ? (v as { title?: string }) : null;
        return <span className="font-medium">{obj?.title ?? "—"}</span>;
      },
    },
    { key: "status", label: "Statut" },
  ],
  payments: [
    { key: "reference", label: "Référence" },
    {
      key: "amount",
      label: "Montant",
      render: (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR")} XAF`,
    },
    { key: "provider", label: "Opérateur" },
    { key: "status", label: "Statut" },
  ],
  notifications: [
    {
      key: "createdAt",
      label: "Reçue le",
      render: (v: unknown) =>
        v ? new Date(String(v)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—",
    },
    { key: "title", label: "Titre" },
    {
      key: "severity",
      label: "Type",
      render: (v: unknown) => String(v ?? "info").toLowerCase(),
    },
  ],
};

export const EMPTY_MESSAGES: Record<string, { message: string; actionLabel?: string; actionHref?: string }> = {
  trips: {
    message: "Aucun voyage. Recherchez un trajet pour commencer.",
    actionLabel: "Rechercher un trajet",
    actionHref: "/results?origin=Yaound%C3%A9&destination=Douala&pax=1",
  },
  hotels: {
    message: "Aucune réservation hôtelière. Trouvez votre hébergement idéal.",
    actionLabel: "Rechercher un hôtel",
    actionHref: "/hotels",
  },
  rentals: {
    message: "Aucune location de véhicule en cours.",
    actionLabel: "Louer un véhicule",
    actionHref: "/rentals",
  },
  parcels: {
    message: "Aucun colis envoyé pour le moment.",
    actionLabel: "Envoyer un colis",
    actionHref: "/parcels",
  },
  insurance: {
    message: "Aucune assurance active.",
    actionLabel: "Souscrire",
    actionHref: "/insurance",
  },
  events: {
    message: "Aucun billet d'événement.",
    actionLabel: "Voir la billetterie",
    actionHref: "/events",
  },
  payments: { message: "Aucun paiement enregistré." },
  notifications: { message: "Aucune notification." },
};
