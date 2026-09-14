"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTransporterProfile,
  getTransporterStats,
  listBookings,
  type TransporterBooking,
  type TransporterStats,
} from "@/lib/api/transporter";

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(v);

export function TransporterDashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<TransporterStats | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [bookings, setBookings] = useState<TransporterBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([getTransporterStats(token), getTransporterProfile(token), listBookings(token, { limit: "5" })])
      .then(([s, p, b]) => {
        if (!live) return;
        setStats(s);
        const rec = p as { companyName?: string; email?: string };
        setCompany(rec.companyName ?? rec.email ?? null);
        setBookings(b.items ?? []);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Erreur de chargement</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const cards = [
    { label: "Trajets actifs", value: stats.activeTrips },
    { label: "Départs du jour", value: stats.upcomingTrips },
    { label: "Réservations totales", value: stats.totalBookings },
    { label: "Réservations aujourd'hui", value: stats.todayBookings },
    { label: "Revenu confirmé (XAF)", value: stats.totalRevenue },
  ];
  const chartData =
    bookings.length > 0
      ? bookings.map((b) => ({ name: b.reference.slice(0, 8), revenue: b.totalAmount }))
      : [{ name: "Total", revenue: stats.totalRevenue }];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Transporteur — Tableau de bord</h1>
      {company && <p className="text-sm text-muted-foreground">Profil : {company}</p>}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="bookings">Réservations</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader>
                  <CardTitle className="text-sm font-normal text-muted-foreground">{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.label.includes("Revenu") ? fmt(c.value) : String(c.value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Revenu récent</CardTitle>
              <CardDescription>Montants des dernières réservations (XAF)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ revenue: { label: "Revenu", color: "var(--chart-1)" } }}>
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Réservations récentes</CardTitle>
              <CardDescription>Les 5 dernières réservations de vos trajets</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Places</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.reference}</TableCell>
                      <TableCell>{b.seatCount}</TableCell>
                      <TableCell>{fmt(b.totalAmount)}</TableCell>
                      <TableCell>{b.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
