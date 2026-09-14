"use client";

import { createElement as el } from "react";
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
    items: Array.isArray(res.items) ? (res.items as unknown[]) : [],
    page: typeof res.page === "number" ? res.page : page,
    perPage: typeof res.perPage === "number" ? res.perPage : perPage,
    totalPages: typeof res.totalPages === "number" ? res.totalPages : 1,
  };
}

function totalOf(res: Envelope | undefined): number {
  return typeof res?.total === "number" ? res.total : 0;
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
  const hotelsCount = useQuery({
    queryKey: ["dashboard-v2-hotels-total", token],
    queryFn: () => fetchMyHotelBookings(token, { page: 1, perPage: 1 }),
    retry: false,
  });
  const rentalsCount = useQuery({
    queryKey: ["dashboard-v2-rentals-total", token],
    queryFn: () => fetchMyRentalBookings(token, { page: 1, perPage: 1 }),
    retry: false,
  });
  const parcelsCount = useQuery({
    queryKey: ["dashboard-v2-parcels-total", token],
    queryFn: () => fetchParcels(token, { page: 1, perPage: 1 }),
    retry: false,
  });
  const eventsCount = useQuery({
    queryKey: ["dashboard-v2-events-total", token],
    queryFn: () => fetchMyEventBookings(token, { page: 1, perPage: 1 }),
    retry: false,
  });

  const data = dashboard.data ?? initialData;
  const counts = {
    trips: data.upcoming.length,
    hotels: totalOf(hotelsCount.data as Envelope | undefined),
    rentals: totalOf(rentalsCount.data as Envelope | undefined),
    parcels: totalOf(parcelsCount.data as Envelope | undefined),
    events: totalOf(eventsCount.data as Envelope | undefined),
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

  return el(
    "div",
    { className: "flex flex-col gap-4" },
    el(SummaryGrid, { counts, trend, isLoading: dashboard.isLoading }),
    el(DashboardTabs, { token, fetchers }),
  );
}
