"use client";

import { createElement as el } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

export type PaymentSummary = {
  byProvider: { provider: string; count: number; total: number }[];
  byMethod: { method: string; count: number }[];
  totalAmount: number;
  totalTransactions: number;
  successRate: number;
};

const PROVIDER_COLORS: Record<string, string> = {
  OrangeMoney: "#ff6b00",
  MTN: "#ffcd00",
  Wave: "#00b4d8",
  Card: "#6366f1",
  Cash: "#94a3b8",
};

function fmtXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function KPICard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return el(Card, { key: label },
    el(CardHeader, null, el(CardTitle, null, label), el(CardDescription, null, sub)),
    el(CardContent, { className: "flex items-baseline gap-2" }, el("p", { className: "text-2xl font-semibold" }, value)),
  );
}

export function PaymentVisualizer({ data }: { data: PaymentSummary }) {
  const barChildren = data.byProvider.map((p, i) =>
    el(Bar, { key: p.provider, dataKey: "count", fill: PROVIDER_COLORS[p.provider] ?? "#06b6d4", radius: [4, 4, 0, 0] },
      el(Cell, { key: "p-" + i, fill: PROVIDER_COLORS[p.provider] ?? "#06b6d4" }),
    ),
  );

  return el("div", { className: "flex flex-col gap-3" },
    el("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3" },
      KPICard({ label: "Transactions", value: data.totalTransactions, sub: "total" }),
      KPICard({ label: "Montant", value: fmtXAF(data.totalAmount) + " XAF", sub: "tous paiements" }),
      KPICard({ label: "Succes", value: (data.successRate * 100).toFixed(0) + "%", sub: "taux de reussite" }),
    ),
    el(Card, null,
      el(CardHeader, null, el(CardTitle, null, "Paiements par operateur"), el(CardDescription, null, "Volume par moyen de paiement")),
      el(CardContent, null,
        data.byProvider.length > 0
          ? el(ChartContainer, {
              config: { payments: { label: "Paiements", color: "#06b6d4" } },
              children: el(BarChart, { data: data.byProvider, margin: { top: 20, right: 30, left: 10, bottom: 5 } },
                el(XAxis, { dataKey: "provider", tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 }, interval: 0 }),
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
