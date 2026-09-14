"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type HotelSummary = {
  byCity: { city: string; count: number; revenue: number }[];
  totalRevenue: number;
  totalBookings: number;
  avgNights: number;
};

const CHART_COLORS = { hotels: "#ec4899" };

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function HotelVisualizer({ data }: { data: HotelSummary }) {
  const barChildren = data.byCity.map((c, i) =>
    el(Bar, { key: c.city, dataKey: "count", fill: CHART_COLORS.hotels, radius: [4, 4, 0, 0] },
      el(Cell, { key: "c-" + i, fill: CHART_COLORS.hotels }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Reservations", value: data.totalBookings, sub: "total hotels" }),
      KPICard({ label: "Revenu", value: fmtXAF(data.totalRevenue) + " XAF", sub: "toutes reservations" }),
      KPICard({ label: "Nuits moy.", value: data.avgNights.toFixed(1), sub: "par reservation" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Reservations par ville"), el(CardDescription, null, "Volume et revenu par destination")),
      el(CardContent, null,
        data.byCity.length > 0
          ? el(ChartContainer, {
              config: { hotels: { label: "Reservations", color: CHART_COLORS.hotels } },
              children: el(BarChart, { data: data.byCity, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "city", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 12 } }),
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
