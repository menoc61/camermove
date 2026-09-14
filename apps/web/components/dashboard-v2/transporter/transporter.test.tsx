import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  getTransporterProfile,
  getTransporterStats,
  listBookings,
} from "@/lib/api/transporter";
import { TransporterDashboard } from "./TransporterDashboard";

vi.mock("@/lib/api/transporter", () => ({
  getTransporterStats: vi.fn(),
  getTransporterProfile: vi.fn(),
  listBookings: vi.fn(),
}));

const mockedStats = vi.mocked(getTransporterStats);
const mockedProfile = vi.mocked(getTransporterProfile);
const mockedBookings = vi.mocked(listBookings);

if (!globalThis.ResizeObserver) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
}

const stats = {
  activeTrips: 4,
  upcomingTrips: 2,
  totalBookings: 18,
  todayBookings: 3,
  totalRevenue: 250000,
};

const bookingsPage = {
  items: [
    {
      id: "b1",
      reference: "CMR-001",
      seatCount: 2,
      totalAmount: 10000,
      status: "CONFIRMED",
      createdAt: "2026-09-01T10:00:00.000Z",
      trip: null,
      user: null,
      passengers: [],
      payments: [],
      tickets: [],
    },
    {
      id: "b2",
      reference: "CMR-002",
      seatCount: 1,
      totalAmount: 5000,
      status: "PENDING",
      createdAt: "2026-09-02T10:00:00.000Z",
      trip: null,
      user: null,
      passengers: [],
      payments: [],
      tickets: [],
    },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, "TransporterDashboard.tsx");

function src(): string {
  return readFileSync(srcPath, "utf8");
}

function renderDashboard() {
  return render(createElement(TransporterDashboard, { token: "tok" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedStats.mockResolvedValue(stats);
  mockedProfile.mockResolvedValue({ companyName: "Nso Boyz" });
  mockedBookings.mockResolvedValue(bookingsPage as never);
});

describe("TransporterDashboard (RED: rebuilt on shadcn)", () => {
  it("shows Skeleton placeholders while loading", () => {
    mockedStats.mockReturnValue(new Promise(() => {}) as never);
    mockedProfile.mockReturnValue(new Promise(() => {}) as never);
    mockedBookings.mockReturnValue(new Promise(() => {}) as never);
    const { container } = renderDashboard();
    expect(
      container.querySelector('[data-slot="skeleton"]'),
      "must use Skeleton while loading",
    ).toBeTruthy();
  });

  it("renders 5 stat cards + profile line", async () => {
    renderDashboard();
    for (const label of [
      "Trajets actifs",
      "Départs du jour",
      "Réservations totales",
      "Réservations aujourd'hui",
      "Revenu confirmé (XAF)",
    ]) {
      expect(await screen.findByText(label), `missing card ${label}`).toBeTruthy();
    }
    expect(await screen.findByText("4"), "activeTrips value missing").toBeTruthy();
    expect(await screen.findByText(/250/), "revenue value missing").toBeTruthy();
    expect(await screen.findByText(/Nso Boyz/), "profile line missing").toBeTruthy();
  });

  it("renders recent bookings in a Table", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole("tab", { name: "Réservations" }));
    expect(await screen.findByText("CMR-001")).toBeTruthy();
    expect(await screen.findByText("CMR-002")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector('[data-slot="table"]')).toBeTruthy();
    });
  });

  it("renders revenue inside ChartContainer", async () => {
    const { container } = renderDashboard();
    await waitFor(() => {
      expect(container.querySelector('[data-slot="chart"]')).toBeTruthy();
    });
  });

  it("shows Alert (role=alert) on API error", async () => {
    mockedStats.mockRejectedValueOnce(new Error("boom"));
    renderDashboard();
    expect(await screen.findByRole("alert"), "must use Alert on error").toBeTruthy();
    expect(await screen.findByText(/boom/)).toBeTruthy();
  });

  it("follows shadcn composition contract + stays <200 lines", () => {
    expect(existsSync(srcPath), "TransporterDashboard.tsx missing").toBe(true);
    const s = src();
    for (const token of [
      "Card",
      "CardHeader",
      "CardTitle",
      "CardContent",
      "Table",
      "TableHeader",
      "TableBody",
      "TableRow",
      "TableHead",
      "TableCell",
      "ChartContainer",
      "Skeleton",
      "Tabs",
      "TabsList",
      "TabsTrigger",
      "TabsContent",
      "Alert",
      "AlertTitle",
      "AlertDescription",
    ]) {
      expect(s, `must use ${token}`).toContain(token);
    }
    expect(s, "TabsTrigger must be inside TabsList").toMatch(
      /<TabsList[\s>][\s\S]*<TabsTrigger/,
    );
    expect(s, "no space-y-* (use flex + gap-*)").not.toMatch(/space-y-/);
    expect(s, "no custom animate-pulse divs (use Skeleton)").not.toMatch(
      /animate-pulse/,
    );
    expect(s, "no raw blue colors (use semantic tokens)").not.toMatch(
      /bg-blue-|text-blue-/,
    );
    expect(s.split("\n").length, "must stay <200 lines").toBeLessThan(200);
  });
});
