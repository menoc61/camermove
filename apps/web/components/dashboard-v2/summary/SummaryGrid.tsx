"use client";

import { createElement as el } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

export type SummaryCounts = {
  trips: number;
  hotels: number;
  rentals: number;
  parcels: number;
  events: number;
};

export type TrendPoint = { label: string; value: number };

const STATS: {
  key: keyof SummaryCounts;
  label: string;
  description: string;
}[] = [
  { key: "trips", label: "Voyages", description: "À venir" },
  { key: "hotels", label: "Hôtels", description: "Réservés" },
  { key: "rentals", label: "Véhicules", description: "Loués" },
  { key: "parcels", label: "Colis", description: "Envoyés" },
  { key: "events", label: "Événements", description: "À venir" },
];

function StatCard({ label, description, value }: { label: string; description: string; value: number }) {
  return el(
    Card,
    { key: label },
    el(
      CardHeader,
      null,
      el(CardTitle, null, label),
      el(CardDescription, null, description),
    ),
    el(CardContent, null, el("p", { className: "text-2xl font-semibold" }, String(value))),
  );
}

function LoadingGrid() {
  return el(
    "div",
    { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-5" },
    ...Array.from({ length: 5 }).map((_, i) =>
      el(
        Card,
        { key: `skeleton-${i}` },
        el(
          CardContent,
          { className: "flex flex-col gap-3 p-4" },
          el(Skeleton, { className: "h-3 w-24" }),
          el(Skeleton, { className: "h-6 w-16" }),
        ),
      ),
    ),
  );
}

export function SummaryGrid({
  counts,
  trend = [],
  isLoading = false,
}: {
  counts?: SummaryCounts;
  trend?: TrendPoint[];
  isLoading?: boolean;
}) {
  if (isLoading || !counts) {
    return el(
      "div",
      { className: "flex flex-col gap-3" },
      el(LoadingGrid, null),
      el(Skeleton, { className: "h-40 w-full" }),
    );
  }
  return el(
    "div",
    { className: "flex flex-col gap-3" },
    el(
      "div",
      { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-5" },
      ...STATS.map((s) =>
        el(StatCard, { key: s.key, label: s.label, description: s.description, value: counts[s.key] }),
      ),
    ),
    el(
      Card,
      null,
      el(
        CardHeader,
        null,
        el(CardTitle, null, "Tendance des réservations"),
        el(CardDescription, null, "Volume par période"),
      ),
      el(
        CardContent,
        null,
        el(ChartContainer, {
          config: { bookings: { label: "Réservations", color: "var(--chart-1)" } },
          children: el(
            AreaChart,
            { data: trend, accessibilityLayer: true },
            el(CartesianGrid, { vertical: false }),
            el(XAxis, { dataKey: "label", tickLine: false, axisLine: false }),
            el(ChartTooltip, { content: el(ChartTooltipContent, null) }),
            el(Area, { dataKey: "value", fill: "var(--color-bookings)", stroke: "var(--color-bookings)" }),
          ),
        }),
      ),
    ),
  );
}
