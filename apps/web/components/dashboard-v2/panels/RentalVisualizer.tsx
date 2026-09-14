"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type RentalSummary = {
  byVehicle: { vehicle: string; count: number; revenue: number }[];
  totalRevenue: number;
  totalRentals: number;
  activeRentals: number;
};

const CHART_COLORS = { rentals: "#14b8a6" };

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function RentalVisualizer({ data }: { data: RentalSummary }) {
  const barChildren = data.byVehicle.map((v, i) =>
    el(Bar, { key: v.vehicle, dataKey: "count", fill: CHART_COLORS.rentals, radius: [4, 4, 0, 0] },
      el(Cell, { key: "v-" + i, fill: CHART_COLORS.rentals }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Locations", value: data.totalRentals, sub: "total" }),
      KPICard({ label: "Actives", value: data.activeRentals, sub: "en cours" }),
      KPICard({ label: "Revenu", value: fmtXAF(data.totalRevenue) + " XAF", sub: "toutes locations" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Locations par véhicule"), el(CardDescription, null, "Par modèle")),
      el(CardContent, null,
        data.byVehicle.length > 0
          ? el(ChartContainer, {
              config: { rentals: { label: "Locations", color: CHART_COLORS.rentals } },
              children: el(BarChart, { data: data.byVehicle, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "vehicle", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
                el(YAxis, { tickLine: false, axisLine: false, width: 40 }),
                el(ChartTooltip, { content: el(ChartTooltipContent, null) }),
                ...barChildren,
              ),
            })
          : el(Skeleton, { className: "h-40 w-full" }),
      ),
    ),
  );
}
