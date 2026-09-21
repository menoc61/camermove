"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboard, type DashboardResponse } from "@/lib/api/dashboard";
import { fetchMyBookings } from "@/lib/api/bookings";
import { fetchMyHotelBookings } from "@/lib/api/hotels";
import { fetchMyRentalBookings } from "@/lib/api/rentals";
import { fetchParcels } from "@/lib/api/parcels";
import { fetchMyInsurancePolicies } from "@/lib/api/insurance";
import { fetchMyEventBookings } from "@/lib/api/events";
import { fetchMyPayments } from "@/lib/api/payments";
import { fetchMyNotifications } from "@/lib/api/notifications";
import { SummaryGrid } from "./summary/SummaryGrid";
import {
  DashboardTabs,
  type DataTabId,
  type TabFetcher,
  type TabPage,
} from "./tabs/DashboardTabs";

type Envelope = {
  items?: unknown;
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
};

function toPage(res: Envelope, page: number, perPage: number): TabPage {
  return {
    items: Array.isArray(res.items) ? (res.items as Record<string, unknown>[]) : [],
    page: typeof res.page === "number" ? res.page : page,
    perPage: typeof res.perPage === "number" ? res.perPage : perPage,
    totalPages: typeof res.totalPages === "number" ? res.totalPages : 1,
  };
}

export function DashboardV2({
  initialData,
  token,
}: {
  initialData: DashboardResponse;
  token: string;
}) {
  const dashboard = useQuery({
    queryKey: ["dashboard-v2", token],
    queryFn: () => getDashboard(token),
    initialData,
    retry: false,
  });

  // Personalized all-services totals come straight from /me/dashboard
  // (full DB counts in one roundtrip) — no per-service count probes needed.
  const data = dashboard.data ?? initialData;
  const t = data.totals;
  const counts = {
    trips: t?.trips ?? data.upcoming.length,
    hotels: t?.hotels ?? 0,
    rentals: t?.rentals ?? 0,
    parcels: t?.parcels ?? 0,
    insurance: t?.insurance ?? 0,
    events: t?.events ?? 0,
  };
  const trend = [
    { label: "À venir", value: data.upcoming.length },
    { label: "Historique", value: data.history.length },
    { label: "Billets", value: data.tickets.length },
  ];

  const fetchers: Partial<Record<DataTabId, TabFetcher>> = {
    trips: async ({ page, perPage }) =>
      toPage(await fetchMyBookings(token, { page, perPage, scope: "upcoming" }), page, perPage),
    hotels: async ({ page, perPage }) =>
      toPage((await fetchMyHotelBookings(token, { page, perPage })) as Envelope, page, perPage),
    rentals: async ({ page, perPage }) =>
      toPage(await fetchMyRentalBookings(token, { page, perPage }), page, perPage),
    parcels: async ({ page, perPage }) =>
      toPage(await fetchParcels(token, { page, perPage }), page, perPage),
    insurance: async ({ page, perPage }) =>
      toPage(await fetchMyInsurancePolicies(token, { page, perPage }), page, perPage),
    events: async ({ page, perPage }) =>
      toPage(await fetchMyEventBookings(token, { page, perPage }), page, perPage),
    payments: async ({ page, perPage }) =>
      toPage(
        await fetchMyPayments(token, { page: String(page), perPage: String(perPage) }),
        page,
        perPage,
      ),
    notifications: async ({ page, perPage }) =>
      toPage(
        await fetchMyNotifications(token, { page: String(page), perPage: String(perPage) }),
        page,
        perPage,
      ),
  };

  return (
    <div className="flex flex-col gap-4">
      <SummaryGrid counts={counts} trend={trend} isLoading={dashboard.isLoading} />
      <DashboardTabs token={token} fetchers={fetchers} />
    </div>
  );
}
