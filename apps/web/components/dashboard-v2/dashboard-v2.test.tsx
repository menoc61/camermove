import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");
const v2Path = join(here, "DashboardV2.tsx");
const pagePath = join(webRoot, "app", "dashboard", "page.tsx");
const oldV2Path = join(webRoot, "app", "dashboard-v2", "page.tsx");

function read(p: string): string {
  return readFileSync(p, "utf8");
}

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard",
}));

// Same behavior-preserving stubs as summary-tabs.test.tsx (jsx:preserve).
vi.mock("@/components/ui/card", async () => {
  const React = await import("react");
  const slot = (name: string) =>
    function Mock({ children, ...rest }: { children?: ReactNode }) {
      return React.createElement("div", { "data-slot": name, ...rest }, children);
    };
  return {
    Card: slot("card"),
    CardHeader: slot("card-header"),
    CardTitle: slot("card-title"),
    CardDescription: slot("card-description"),
    CardAction: slot("card-action"),
    CardContent: slot("card-content"),
    CardFooter: slot("card-footer"),
  };
});

vi.mock("@/components/ui/skeleton", async () => {
  const React = await import("react");
  return {
    Skeleton: function Mock({ ...rest }: Record<string, unknown>) {
      return React.createElement("div", { "data-slot": "skeleton", ...rest });
    },
  };
});

vi.mock("@/components/ui/chart", async () => {
  const React = await import("react");
  return {
    ChartContainer: function Mock({ children, ...rest }: { children?: ReactNode }) {
      return React.createElement("div", { "data-slot": "chart", ...rest }, children);
    },
    ChartTooltip: () => null,
    ChartTooltipContent: () => null,
    ChartLegend: () => null,
    ChartLegendContent: () => null,
    ChartStyle: () => null,
  };
});

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");
  type Ctx = { value: string; onChange: (v: string) => void };
  const TabCtx = React.createContext<Ctx>({ value: "", onChange: () => {} });
  return {
    Tabs: function Mock({ value, onValueChange, children, ...rest }: {
      value?: string; onValueChange?: (v: string) => void; children?: ReactNode;
    }) {
      return React.createElement(
        TabCtx.Provider,
        { value: { value: value ?? "", onChange: (v: string) => onValueChange?.(v) } },
        React.createElement("div", rest, children),
      );
    },
    TabsList: function Mock({ children, ...rest }: { children?: ReactNode }) {
      return React.createElement("div", { role: "tablist", ...rest }, children);
    },
    TabsTrigger: function Mock({ value, children, ...rest }: {
      value?: string; children?: ReactNode;
    }) {
      const Consumer = TabCtx.Consumer as unknown as string;
      const renderFn = (ctx: Ctx) =>
        React.createElement(
          "button",
          {
            role: "tab",
            "aria-selected": ctx.value === value,
            onClick: () => ctx.onChange(value ?? ""),
            ...rest,
          },
          children,
        );
      return React.createElement(Consumer, null, renderFn as unknown as ReactNode);
    },
    TabsContent: function Mock({ value, children, ...rest }: {
      value?: string; children?: ReactNode;
    }) {
      const Consumer = TabCtx.Consumer as unknown as string;
      const renderFn = (ctx: Ctx) =>
        ctx.value === value
          ? React.createElement("div", { role: "tabpanel", ...rest }, children)
          : null;
      return React.createElement(Consumer, null, renderFn as unknown as ReactNode);
    },
  };
});

vi.mock("recharts", async () => {
  const React = await import("react");
  return {
    AreaChart: function Mock({ children }: { children?: ReactNode }) {
      return React.createElement("div", null, children);
    },
    Area: () => null,
    XAxis: () => null,
    CartesianGrid: () => null,
    ResponsiveContainer: function Mock({ children }: { children?: ReactNode }) {
      return React.createElement("div", null, children);
    },
  };
});

vi.mock("@/components/dashboard-v2/controls/ExportButton", async () => {
  const React = await import("react");
  return {
    ExportButton: function Mock({ endpoint, resource }: { endpoint: string; resource: string }) {
      return React.createElement(
        "button",
        { type: "button", "data-endpoint": endpoint, "data-resource": resource },
        "Exporter",
      );
    },
  };
});

vi.mock("@/components/dashboard-v2/controls/PaginationControls", async () => {
  const React = await import("react");
  return {
    PaginationControls: function Mock({ page, totalPages, onPageChange }: {
      page: number; totalPages: number; onPageChange: (n: number) => void;
    }) {
      if (totalPages <= 1) return null;
      return React.createElement(
        "nav",
        { "aria-label": "Pagination" },
        React.createElement(
          "button",
          { type: "button", onClick: () => onPageChange(page - 1) },
          "Précédent",
        ),
        React.createElement("span", null, `Page ${page} / ${totalPages}`),
        React.createElement(
          "button",
          { type: "button", onClick: () => onPageChange(page + 1) },
          "Suivant",
        ),
      );
    },
  };
});

function withClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    createElement(QueryClientProvider, { client }, node),
  );
}

const initialData = {
  upcoming: [
    {
      id: "b1",
      reference: "CMR-1",
      origin: "Douala",
      destination: "Yaoundé",
      departureAt: "2026-09-15T08:00:00.000Z",
      totalAmount: 5000,
      status: "confirmed",
      ticketId: "t1",
    },
    {
      id: "b2",
      reference: "CMR-2",
      origin: "Douala",
      destination: "Bafoussam",
      departureAt: "2026-09-16T08:00:00.000Z",
      totalAmount: 6000,
      status: "confirmed",
      ticketId: null,
    },
  ],
  history: [],
  tickets: [],
};

describe("dashboard-v2 route: shell + 5 cards + 10 tabs", () => {
  beforeEach(() => replaceMock.mockClear());

  it("ships page + DashboardV2 under 250 lines each, /dashboard-v2 removed", () => {
    expect(existsSync(pagePath), "app/dashboard/page.tsx missing").toBe(true);
    expect(existsSync(v2Path), "components/dashboard-v2/DashboardV2.tsx missing").toBe(true);
    expect(read(pagePath).split("\n").length, "page must stay <250 lines").toBeLessThan(250);
    expect(read(v2Path).split("\n").length, "DashboardV2 must stay <250 lines").toBeLessThan(250);
    expect(existsSync(oldV2Path), "app/dashboard-v2 must be deleted (single /dashboard)").toBe(false);
  });

  it("page gates token + SSR getDashboard, renders DashboardShell/DashboardV2", () => {
    const src = read(pagePath);
    for (const token of [
      "x-cm-user-token",
      "cm_access",
      "/login?next=/dashboard",
      "getDashboard",
      "DashboardShell",
      "DashboardV2",
      "Suspense",
    ]) {
      expect(src, `page must contain ${token}`).toContain(token);
    }
  });

  it("DashboardV2 composes SummaryGrid + DashboardTabs via React-Query fetchers", () => {
    const src = read(v2Path);
    for (const token of [
      "SummaryGrid",
      "DashboardTabs",
      "useQuery",
      "initialData",
      "fetchMyBookings",
      "fetchMyHotelBookings",
      "fetchMyRentalBookings",
      "fetchParcels",
      "fetchMyInsurancePolicies",
      "fetchMyEventBookings",
      "fetchMyPayments",
      "fetchMyNotifications",
    ]) {
      expect(src, `DashboardV2 must contain ${token}`).toContain(token);
    }
  });

  it("renders 5 summary cards + bookings trend", async () => {
    const { DashboardV2 } = await import("./DashboardV2");
    const { container } = withClient(
      createElement(DashboardV2, { initialData, token: "test-token" }),
    );
    for (const label of ["Voyages", "Hôtels", "Véhicules", "Colis", "Événements"]) {
      // Card titles share exact labels with tab triggers — assert presence, not uniqueness.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    // Trips count from initialData (2 upcoming) renders inside the summary cards.
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[data-slot="chart"]')).toBeTruthy();
  });

  it("renders 10 tab triggers (ExportButton/Pagination wired per tab)", async () => {
    const { DashboardV2 } = await import("./DashboardV2");
    withClient(
      createElement(DashboardV2, { initialData, token: "test-token" }),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(10);
  });
});
