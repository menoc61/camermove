"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bus,
  BedDouble,
  CarFront,
  Package,
  ShieldCheck,
  Ticket,
  Wallet,
  Bell,
  Heart,
  LifeBuoy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButton } from "../controls/ExportButton";
import { CancelButton } from "../controls/CancelButton";
import { cancelBooking } from "@/lib/api/bookings";
import { cancelParcel, createParcelPayment } from "@/lib/api/parcels";
import { PaginationControls } from "../controls/PaginationControls";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "../cards/EmptyState";
import { DataTable } from "../panels";
import { GENERIC_COLUMNS, EMPTY_MESSAGES } from "./tabColumns";
import { FavoritesPanel, SupportPanel } from "./tabStatic";

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
  items: Record<string, unknown>[];
  page: number;
  perPage: number;
  totalPages: number;
};

export type TabFetcher = (args: {
  token: string;
  page: number;
  perPage: number;
}) => Promise<TabPage>;

const TABS: { value: DashboardTabId; label: string; icon: typeof Bus }[] = [
  { value: "trips", label: "Voyages", icon: Bus },
  { value: "hotels", label: "Hôtels", icon: BedDouble },
  { value: "rentals", label: "Véhicules", icon: CarFront },
  { value: "parcels", label: "Colis", icon: Package },
  { value: "insurance", label: "Assurances", icon: ShieldCheck },
  { value: "events", label: "Événements", icon: Ticket },
  { value: "payments", label: "Paiements", icon: Wallet },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "favorites", label: "Favoris", icon: Heart },
  { value: "support", label: "Support", icon: LifeBuoy },
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
  notifications: "/api/v1/me/notifications/export",
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
    placeholderData: (prev) => prev,
  });
}

function isTabId(value: string | null): value is DashboardTabId {
  return TABS.some((t) => t.value === value);
}

/* Per-tab column definitions and empty-state copy live in ./tabColumns.tsx
 * — extracted so this orchestrator file stays under 250 lines
 * (AGENTS.md §4: "any file >300 lines is a split candidate"). */


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
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function renderPanel(tab: DataTabId) {
    const q = queries[tab];
    const data = q.data ?? { ...EMPTY_PAGE, page: pages[tab] };
    const columns = GENERIC_COLUMNS[tab] ?? [];
    const empty = EMPTY_MESSAGES[tab] ?? { message: "Aucun élément pour le moment." };
    const totalLabel = `${data.items.length} élément(s) · page ${data.page}/${Math.max(data.totalPages, 1)}`;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {q.isFetching ? "Chargement…" : totalLabel}
          </p>
          <ExportButton token={token} endpoint={EXPORT_ENDPOINTS[tab]} resource={tab} />
        </div>
        {q.isFetching && data.items.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title="Aucun élément pour le moment"
            description={empty.message}
            cta={
              empty.actionLabel && empty.actionHref
                ? { label: empty.actionLabel, href: empty.actionHref }
                : undefined
            }
          />
        ) : tab === "parcels" ? (
          <div className="flex flex-col gap-2">
            <DataTable columns={[...columns]} data={data.items} />
            <div className="flex flex-wrap gap-2">
              {data.items
                .filter((row) => String(row.status) === "registered")
                .slice(0, 3)
                .map((row) => (
                  <div key={String(row.id)} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground">{String(row.trackingNumber ?? row.id)}</span>
                    <ParcelRowActions id={String(row.id)} token={token} />
                  </div>
                ))}
            </div>
          </div>
        ) : tab === "trips" ? (
          <div className="flex flex-col gap-2">
            <DataTable columns={[...columns]} data={data.items} />
            <div className="flex flex-wrap gap-2">
              {data.items
                .filter((row) => ["pending_payment", "confirmed"].includes(String(row.status)))
                .slice(0, 3)
                .map((row) => (
                  <div key={String(row.id)} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground">Réf. {String(row.reference ?? row.id)}</span>
                    <CancelButton
                      visible
                      onCancel={() => cancelBooking(String(row.id), token)}
                      invalidateKeys={[["dashboard-trips"], ["dashboard-v2"]]}
                    />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <DataTable columns={[...columns]} data={data.items} />
        )}
        <PaginationControls
          page={data.page}
          totalPages={data.totalPages}
          isFetching={q.isFetching}
          onPageChange={setPage(tab)}
        />
      </div>
    );
  }

  function renderStaticPanel(tab: DashboardTabId) {
    if (tab === "favorites") return <FavoritesPanel />;
    if (tab === "support") return <SupportPanel />;
    return renderPanel(tab);
  }

  return (
    <Tabs value={activeTab} onValueChange={switchTab} className="w-full">
      <TabsList className="sticky top-0 z-10 w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-background/95 p-1 backdrop-blur">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex min-h-[44px] flex-1 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          {renderStaticPanel(t.value)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ParcelRowActions({ id, token }: { id: string; token: string }) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  async function pay() {
    setPaying(true);
    setPayError(null);
    try {
      const res = await createParcelPayment(id, token);
      const url = res.paymentUrl ?? res.authorizationUrl;
      if (!url) {
        setPayError("Paiement impossible");
        setPaying(false);
        return;
      }
      window.location.href = url;
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Paiement impossible");
      setPaying(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={paying}
        onClick={pay}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {paying ? "Paiement…" : "Payer"}
      </button>
      {payError ? <span role="alert" className="text-xs text-destructive">{payError}</span> : null}
      <CancelButton visible onCancel={() => cancelParcel(token, id)} invalidateKeys={[["dashboard-parcels"], ["dashboard-v2"]]} />
    </div>
  );
}


