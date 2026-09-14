"use client";

import { createElement as el, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButton } from "../controls/ExportButton";
import { PaginationControls } from "../controls/PaginationControls";

export const TAB_PER_PAGE = 20;

export type DashboardTabId =
  | "trips"
  | "hotels"
  | "rentals"
  | "parcels"
  | "insurance"
  | "events"
  | "payments"
  | "notifications"
  | "favorites"
  | "support";

export type DataTabId = Exclude<DashboardTabId, "favorites" | "support">;

export type TabPage = {
  items: unknown[];
  page: number;
  perPage: number;
  totalPages: number;
};

export type TabFetcher = (args: {
  token: string;
  page: number;
  perPage: number;
}) => Promise<TabPage>;

const TABS: { value: DashboardTabId; label: string }[] = [
  { value: "trips", label: "Voyages à venir" },
  { value: "hotels", label: "Hôtels" },
  { value: "rentals", label: "Véhicules" },
  { value: "parcels", label: "Colis" },
  { value: "insurance", label: "Assurances" },
  { value: "events", label: "Événements" },
  { value: "payments", label: "Paiements" },
  { value: "notifications", label: "Notifications" },
  { value: "favorites", label: "Favoris" },
  { value: "support", label: "Support" },
];

const QUERY_KEYS: Record<DataTabId, string> = {
  trips: "dashboard-trips",
  hotels: "dashboard-hotels",
  rentals: "dashboard-rentals",
  parcels: "dashboard-parcels",
  insurance: "dashboard-insurance",
  events: "dashboard-events",
  payments: "dashboard-payments",
  notifications: "dashboard-notifications",
};

const EXPORT_ENDPOINTS: Record<DataTabId, string> = {
  trips: "/api/v1/bookings/export",
  hotels: "/api/v1/hotels/bookings/export",
  rentals: "/api/v1/rentals/bookings/export",
  parcels: "/api/v1/parcels/export",
  insurance: "/api/v1/insurance/policies/export",
  events: "/api/v1/events/bookings/export",
  payments: "/api/v1/payments/export",
  notifications: "/api/v1/notifications/export",
};

const EMPTY_PAGE: TabPage = { items: [], page: 1, perPage: TAB_PER_PAGE, totalPages: 1 };

function useTabItems(
  key: string,
  token: string,
  page: number,
  fetcher?: TabFetcher,
) {
  return useQuery({
    queryKey: [key, token, page, TAB_PER_PAGE],
    queryFn: () =>
      fetcher
        ? fetcher({ token, page, perPage: TAB_PER_PAGE })
        : Promise.resolve({ ...EMPTY_PAGE, page }),
  });
}

function isTabId(value: string | null): value is DashboardTabId {
  return TABS.some((t) => t.value === value);
}

export function DashboardTabs({
  token,
  fetchers,
}: {
  token: string;
  fetchers?: Partial<Record<DataTabId, TabFetcher>>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<DataTabId, number>>({
    trips: 1,
    hotels: 1,
    rentals: 1,
    parcels: 1,
    insurance: 1,
    events: 1,
    payments: 1,
    notifications: 1,
  });

  const param = searchParams.get("tab");
  const activeTab: DashboardTabId = isTabId(param) ? param : "trips";

  const trips = useTabItems(QUERY_KEYS.trips, token, pages.trips, fetchers?.trips);
  const hotels = useTabItems(QUERY_KEYS.hotels, token, pages.hotels, fetchers?.hotels);
  const rentals = useTabItems(QUERY_KEYS.rentals, token, pages.rentals, fetchers?.rentals);
  const parcels = useTabItems(QUERY_KEYS.parcels, token, pages.parcels, fetchers?.parcels);
  const insurance = useTabItems(QUERY_KEYS.insurance, token, pages.insurance, fetchers?.insurance);
  const events = useTabItems(QUERY_KEYS.events, token, pages.events, fetchers?.events);
  const payments = useTabItems(QUERY_KEYS.payments, token, pages.payments, fetchers?.payments);
  const notifications = useTabItems(
    QUERY_KEYS.notifications,
    token,
    pages.notifications,
    fetchers?.notifications,
  );

  const queries: Record<DataTabId, ReturnType<typeof useTabItems>> = {
    trips,
    hotels,
    rentals,
    parcels,
    insurance,
    events,
    payments,
    notifications,
  };

  function setPage(tab: DataTabId) {
    return (next: number) =>
      setPages((prev) => ({ ...prev, [tab]: next }));
  }

  function switchTab(value: string) {
    if (!isTabId(value)) return;
    setPendingTab(value);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function dataPanel(tab: DataTabId) {
    const q = queries[tab];
    const data = q.data ?? { ...EMPTY_PAGE, page: pages[tab] };
    return el(
      "div",
      { className: "flex flex-col gap-3", key: `panel-${tab}` },
      el(ExportButton, { token, endpoint: EXPORT_ENDPOINTS[tab], resource: tab }),
      el(
        "p",
        { className: "text-sm text-muted-foreground" },
        q.isFetching ? "Chargement…" : `${data.items.length} élément(s)`,
      ),
      el(PaginationControls, {
        page: data.page,
        totalPages: data.totalPages,
        isFetching: q.isFetching,
        onPageChange: setPage(tab),
      }),
    );
  }

  function panelFor(tab: DashboardTabId) {
    if (tab === "favorites")
      return el("p", { className: "text-sm text-muted-foreground" }, "Aucun favori pour le moment.");
    if (tab === "support")
      return el("p", { className: "text-sm text-muted-foreground" }, "Contactez le support depuis cette page.");
    return dataPanel(tab);
  }

  return el(
    Tabs,
    { value: pendingTab ?? activeTab, onValueChange: switchTab, className: "w-full" },
    el(
      TabsList,
      { className: "w-full overflow-x-auto" },
      ...TABS.map((t) =>
        el(TabsTrigger, { key: t.value, value: t.value, className: "min-h-[44px] flex-1 whitespace-nowrap" }, t.label),
      ),
    ),
    ...TABS.map((t) =>
      el(TabsContent, { key: t.value, value: t.value, className: "mt-4" }, panelFor(t.value)),
    ),
  );
}
