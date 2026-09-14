"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type InsuranceSummary = {
  byCoverage: { coverage: string; count: number; premium: number }[];
  totalPremium: number;
  activePolicies: number;
  expiringSoon: number;
};

const CHART_COLORS = { insurance: "#8b5cf6" };

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function InsuranceVisualizer({ data }: { data: InsuranceSummary }) {
  const barChildren = data.byCoverage.map((c, i) =>
    el(Bar, { key: c.coverage, dataKey: "premium", fill: CHART_COLORS.insurance, radius: [4, 4, 0, 0] },
      el(Cell, { key: "c-" + i, fill: CHART_COLORS.insurance }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Polices actives", value: data.activePolicies, sub: "total" }),
      KPICard({ label: "Expirant bientot", value: data.expiringSoon, sub: "dans 30 jours" }),
      KPICard({ label: "Primes", value: fmtXAF(data.totalPremium) + " XAF", sub: "total percu" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Primes par formule"), el(CardDescription, null, "Revenu par type de couverture")),
      el(CardContent, null,
        data.byCoverage.length > 0
          ? el(ChartContainer, {
              config: { insurance: { label: "Primes (XAF)", color: CHART_COLORS.insurance } },
              children: el(BarChart, { data: data.byCoverage, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "coverage", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
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
