import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const here = dirname(fileURLToPath(import.meta.url));
const summaryPath = join(here, "summary", "SummaryGrid.tsx");
const tabsPath = join(here, "tabs", "DashboardTabs.tsx");

function read(p: string): string {
  return readFileSync(p, "utf8");
}

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard",
}));

// Repo tsconfig uses jsx:preserve, so vitest cannot parse JSX-syntax files.
// Mock the shadcn primitives with behavior-preserving stubs (same data-slots,
// roles, and controlled tab switching); source guards below verify the real
// composition (CardHeader, ChartContainer, TabsTrigger inside TabsList).
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

describe("summary-tabs contract", () => {
  beforeEach(() => replaceMock.mockClear());

  it("ships SummaryGrid + DashboardTabs under 250 lines each", () => {
    expect(existsSync(summaryPath), "SummaryGrid.tsx missing").toBe(true);
    expect(existsSync(tabsPath), "DashboardTabs.tsx missing").toBe(true);
    expect(
      read(summaryPath).split("\n").length,
      "SummaryGrid must stay <250 lines",
    ).toBeLessThan(250);
    expect(
      read(tabsPath).split("\n").length,
      "DashboardTabs must stay <250 lines",
    ).toBeLessThan(250);
  });

  it("renders 6 stat cards + bookings trend chart", async () => {
    const { SummaryGrid } = await import("./summary/SummaryGrid");
    const { container } = withClient(
      createElement(SummaryGrid, {
        counts: { trips: 3, hotels: 1, rentals: 0, parcels: 2, insurance: 1, events: 5 },
        trend: [
          { label: "Jan", value: 2 },
          { label: "Fev", value: 4 },
        ],
      }),
    );
    for (const label of ["Voyages", "Hôtels", "Véhicules", "Colis", "Assurances", "Événements"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("3")).toBeTruthy();
    expect(container.querySelector('[data-slot="chart"]')).toBeTruthy();
  });

  it("shows Skeleton loading state", async () => {
    const { SummaryGrid } = await import("./summary/SummaryGrid");
    const { container } = withClient(createElement(SummaryGrid, { isLoading: true }));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    const src = read(summaryPath);
    expect(src).toContain("Skeleton");
    expect(src).toContain("ChartContainer");
    expect(src).toContain("CardHeader");
  });

  it("renders 10 tab triggers inside TabsList", async () => {
    const { DashboardTabs } = await import("./tabs/DashboardTabs");
    withClient(createElement(DashboardTabs, { token: "test-token" }));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(10);
    const src = read(tabsPath);
    for (const id of [
      "trips",
      "hotels",
      "rentals",
      "parcels",
      "insurance",
      "events",
      "payments",
      "notifications",
      "favorites",
      "support",
    ]) {
      expect(src, `missing tab ${id}`).toContain(`"${id}"`);
    }
    expect(src).toContain("TabsList");
    expect(src).toContain("TabsTrigger");
  });

  it("switches tabs and syncs ?tab= via router.replace", async () => {
    const { DashboardTabs } = await import("./tabs/DashboardTabs");
    withClient(createElement(DashboardTabs, { token: "test-token" }));
    fireEvent.click(screen.getByRole("tab", { name: /Hôtels/ }));
    expect(replaceMock).toHaveBeenCalled();
    expect(String(replaceMock.mock.calls[0]?.[0] ?? "")).toContain("tab=hotels");
  });

  it("wires per-tab paging, query keys, export + pagination", () => {
    const src = read(tabsPath);
    expect(src).toContain("TAB_PER_PAGE");
    expect(src).toMatch(/TAB_PER_PAGE\s*=\s*20/);
    expect(src).toContain("useSearchParams");
    expect(src).toContain("router.replace");
    expect(src).toContain("PaginationControls");
    // Export buttons moved to per-section panels (trips/events/payments/…).
    expect(read(join(here, "panels", "TripsPanel.tsx"))).toContain("ExportButton");
    expect(read(join(here, "panels", "EventsPanel.tsx"))).toContain("ExportButton");
    expect(read(join(here, "panels", "PaymentsPanel.tsx"))).toContain("ExportButton");
    for (const key of [
      "dashboard-hotels",
      "dashboard-rentals",
      "dashboard-parcels",
      "dashboard-insurance",
      "dashboard-events",
      "dashboard-payments",
      "dashboard-notifications",
    ]) {
      expect(src, `missing query key ${key}`).toContain(key);
    }
  });
});
