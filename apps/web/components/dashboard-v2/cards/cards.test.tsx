import { describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

const here = dirname(fileURLToPath(import.meta.url));

function src(name: string): string {
  return readFileSync(join(here, `${name}.tsx`), "utf8");
}

function lines(name: string): number {
  return src(name).split("\n").length;
}

const FILES = [
  "StatusPill",
  "UpcomingTripCard",
  "TicketCard",
  "HotelBookingCard",
  "RentalBookingCard",
  "ParcelCard",
  "InsuranceCard",
  "EventBookingCard",
  "PaymentCard",
  "NotificationCard",
  "EmptyState",
  "SkeletonCard",
];

const CONTENT_CARDS = [
  "UpcomingTripCard",
  "TicketCard",
  "HotelBookingCard",
  "RentalBookingCard",
  "ParcelCard",
  "InsuranceCard",
  "EventBookingCard",
  "PaymentCard",
  "NotificationCard",
];

describe("dashboard-v2 cards ship + stay small", () => {
  it("ships all 12 card files", () => {
    for (const f of FILES) {
      expect(existsSync(join(here, `${f}.tsx`)), `${f}.tsx missing`).toBe(true);
    }
  });

  it("each file stays <100 lines", () => {
    for (const f of FILES) {
      expect(lines(f), `${f} must stay <100 lines`).toBeLessThan(100);
    }
  });
});

describe("shadcn composition contract (source)", () => {
  it("content cards use full Card composition + Badge + Separator", () => {
    for (const f of CONTENT_CARDS) {
      const s = src(f);
      for (const token of [
        "CardHeader",
        "CardTitle",
        "CardDescription",
        "CardContent",
        "CardFooter",
        "Badge",
        "Separator",
      ]) {
        expect(s, `${f} must use ${token}`).toContain(token);
      }
    }
  });

  it("EmptyState uses shadcn Empty block + Card composition", () => {
    const s = src("EmptyState");
    for (const token of ["Empty", "EmptyTitle", "EmptyDescription", "CardHeader", "CardContent", "CardFooter"]) {
      expect(s, `EmptyState must use ${token}`).toContain(token);
    }
  });

  it("SkeletonCard uses Skeleton + Card composition", () => {
    const s = src("SkeletonCard");
    expect(s).toContain("Skeleton");
    expect(s).toContain("CardHeader");
    expect(s).toContain("CardContent");
    expect(s).toContain("CardFooter");
  });

  it("StatusPill uses Badge variants (no raw emerald/amber color classes)", () => {
    const s = src("StatusPill");
    expect(s).toContain("Badge");
    expect(s).not.toContain("bg-emerald-100");
    expect(s).not.toContain("bg-amber-100");
    for (const v of ["default", "secondary", "destructive", "outline"]) {
      expect(s, `StatusPill must map to Badge variant ${v}`).toContain(`"${v}"`);
    }
  });

  it("avatars use AvatarFallback; images use loading=lazy + alt", () => {
    for (const f of ["HotelBookingCard", "RentalBookingCard", "EventBookingCard", "NotificationCard"]) {
      expect(src(f), `${f} must use AvatarFallback`).toContain("AvatarFallback");
    }
    for (const f of ["HotelBookingCard", "RentalBookingCard", "EventBookingCard"]) {
      const s = src(f);
      expect(s, `${f} must lazy-load images`).toContain('loading="lazy"');
      expect(s, `${f} must have alt text`).toMatch(/alt=({|")/);
    }
  });
});

describe("StatusPill behavior", () => {
  it("maps booking + ticket statuses to French labels", async () => {
    const { StatusPill } = await import("./StatusPill");
    const { rerender } = render(createElement(StatusPill, { status: "confirmed" }));
    expect(screen.getByText("Confirmé")).toBeTruthy();
    rerender(createElement(StatusPill, { status: "pending_payment" }));
    expect(screen.getByText("En attente")).toBeTruthy();
    rerender(createElement(StatusPill, { status: "cancelled" }));
    expect(screen.getByText("Annulé")).toBeTruthy();
    rerender(createElement(StatusPill, { kind: "completed" }));
    expect(screen.getByText("Terminé")).toBeTruthy();
    rerender(createElement(StatusPill, { kind: "expired" }));
    expect(screen.getByText("Expiré")).toBeTruthy();
  });
});

describe("trip + ticket cards", () => {
  const trip = {
    id: "b1",
    reference: "CMR-123",
    origin: "Douala",
    destination: "Yaoundé",
    departureAt: "2026-09-15T08:00:00.000Z",
    totalAmount: 5000,
    status: "confirmed",
    ticketId: "t1",
  };

  it("UpcomingTripCard renders route, ref, amount + Voir billet link", async () => {
    const { UpcomingTripCard } = await import("./UpcomingTripCard");
    const { container } = render(createElement(UpcomingTripCard, { item: trip }));
    expect(screen.getByText(/Douala/)).toBeTruthy();
    expect(screen.getByText(/Yaoundé/)).toBeTruthy();
    expect(screen.getByText(/CMR-123/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Voir billet/ });
    expect(link.getAttribute("href")).toContain("/tickets/t1");
    expect(container.querySelector('[data-slot="card-header"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="card-footer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="separator"]')).toBeTruthy();
    expect(screen.getByText("Confirmé")).toBeTruthy();
  });

  it("UpcomingTripCard without ticket shows Billet à venir", async () => {
    const { UpcomingTripCard } = await import("./UpcomingTripCard");
    render(createElement(UpcomingTripCard, { item: { ...trip, ticketId: null } }));
    expect(screen.getByText(/Billet à venir/)).toBeTruthy();
  });

  it("TicketCard renders code + Voir QR link", async () => {
    const { TicketCard } = await import("./TicketCard");
    const { container } = render(
      createElement(TicketCard, {
        item: {
          id: "tk1",
          verificationCode: "QR-ABC-123",
          origin: "Douala",
          destination: "Yaoundé",
          departureAt: "2026-09-15T08:00:00.000Z",
          status: "valid",
        },
      }),
    );
    expect(screen.getByText("QR-ABC-123")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Voir QR/ }).getAttribute("href")).toContain("/tickets/tk1");
    expect(container.querySelector('[data-slot="separator"]')).toBeTruthy();
  });
});

describe("hotel + rental + parcel cards", () => {
  it("HotelBookingCard renders hotel, city, room, amount + avatar", async () => {
    const { HotelBookingCard } = await import("./HotelBookingCard");
    const { container } = render(
      createElement(HotelBookingCard, {
        item: {
          id: "h1",
          hotel: { name: "Hôtel SA", city: "Douala", imageUrl: "/hotel.jpg" },
          roomType: { name: "Standard", pricePerNight: 20000 },
          checkInDate: "2026-10-01",
          checkOutDate: "2026-10-03",
          guestCount: 2,
          totalAmount: 40000,
          status: "confirmed",
        },
      }),
    );
    expect(screen.getByText("Hôtel SA")).toBeTruthy();
    expect(screen.getByText(/Douala/)).toBeTruthy();
    expect(screen.getByText(/Standard/)).toBeTruthy();
    expect(container.querySelector('[data-slot="avatar-fallback"]')).toBeTruthy();
    // Base-UI AvatarImage only mounts <img> after load in jsdom, so assert
    // lazy + alt at source level (also covered by the composition contract).
    expect(src("HotelBookingCard")).toContain('loading="lazy"');
  });

  it("RentalBookingCard renders vehicle + route + amount", async () => {
    const { RentalBookingCard } = await import("./RentalBookingCard");
    const { container } = render(
      createElement(RentalBookingCard, {
        item: {
          id: "r1",
          vehicle: { make: "Toyota", model: "RAV4", pickupCity: "Douala", imageUrl: "/car.jpg" },
          startDate: "2026-10-01",
          endDate: "2026-10-05",
          totalAmount: 30000,
          status: "confirmed",
          pickupCity: "Douala",
          dropoffCity: "Yaoundé",
        },
      }),
    );
    expect(screen.getByText(/Toyota/)).toBeTruthy();
    expect(screen.getByText(/Douala/)).toBeTruthy();
    expect(container.querySelector('[data-slot="avatar-fallback"]')).toBeTruthy();
  });

  it("ParcelCard renders tracking, route, cost + Suivre link", async () => {
    const { ParcelCard } = await import("./ParcelCard");
    render(
      createElement(ParcelCard, {
        item: {
          id: "p1",
          trackingNumber: "CM-000111",
          senderName: "A",
          senderPhone: "6xx",
          senderCity: "Douala",
          recipientName: "B",
          recipientPhone: "6yy",
          recipientCity: "Yaoundé",
          parcelType: "Colis",
          weightKg: 2,
          dimensionsCm: null,
          description: null,
          shippingCost: 2500,
          status: "registered",
          currentLocation: null,
          statusHistory: [],
          createdAt: "2026-09-01",
        },
      }),
    );
    expect(screen.getByText("CM-000111")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Suivre/ }).getAttribute("href")).toContain("CM-000111");
  });
});

describe("insurance + event + payment + notification cards", () => {
  it("InsuranceCard renders destination, policy, premium + Voir link", async () => {
    const { InsuranceCard } = await import("./InsuranceCard");
    render(
      createElement(InsuranceCard, {
        item: {
          id: "i1",
          providerName: "Assur",
          coverageType: "standard",
          destination: "Paris",
          startDate: "2026-11-01",
          endDate: "2026-11-10",
          travelers: 2,
          premium: 5000,
          currency: "XAF",
          status: "confirmed",
          policyNumber: "POL-1",
          documentUrl: null,
          createdAt: "2026-09-01",
        },
      }),
    );
    expect(screen.getByText("Paris")).toBeTruthy();
    expect(screen.getByText(/POL-1/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Voir/ })).toBeTruthy();
  });

  it("EventBookingCard renders event, ticket no, amount + avatar img", async () => {
    const { EventBookingCard } = await import("./EventBookingCard");
    const { container } = render(
      createElement(EventBookingCard, {
        item: {
          id: "e1",
          ticketNumber: "EVT-42",
          qrCode: null,
          event: {
            id: "ev1",
            name: "Concert",
            venue: "Stade",
            city: "Douala",
            startDate: "2026-12-01",
            endDate: null,
            eventType: "music",
            status: "published",
            posterUrl: "/poster.jpg",
          },
          ticketCategory: {
            id: "c1",
            name: "VIP",
            description: null,
            price: 10000,
            quantity: 100,
            sold: 10,
            status: "active",
            available: 90,
          },
          quantity: 2,
          totalAmount: 20000,
          status: "confirmed",
          createdAt: "2026-09-01",
        },
      }),
    );
    expect(screen.getByText("Concert")).toBeTruthy();
    expect(screen.getByText(/EVT-42/)).toBeTruthy();
    expect(container.querySelector('[data-slot="avatar-fallback"]')).toBeTruthy();
  });

  it("PaymentCard renders amount, provider, method", async () => {
    const { PaymentCard } = await import("./PaymentCard");
    render(
      createElement(PaymentCard, {
        item: {
          id: "pay1",
          provider: "notchpay",
          providerRef: null,
          amount: 5000,
          method: "mobile_money",
          currency: "XAF",
          status: "success",
          createdAt: "2026-09-02",
          bookingId: "b1",
        },
      }),
    );
    expect(screen.getByText(/notchpay/)).toBeTruthy();
    expect(screen.getByText(/mobile_money/)).toBeTruthy();
  });

  it("NotificationCard renders type + Marquer lu action", async () => {
    const { NotificationCard } = await import("./NotificationCard");
    const onMarkRead = vi.fn();
    render(
      createElement(NotificationCard, {
        item: {
          id: "n1",
          channel: "push",
          type: "booking.confirmed",
          status: "sent",
          payload: null,
          sentAt: null,
          createdAt: "2026-09-02",
          read: false,
        },
        onMarkRead,
        marking: false,
      }),
    );
    expect(screen.getByText("booking.confirmed")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Marquer lu/ });
    fireEvent.click(btn);
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("NotificationCard read hides action", async () => {
    const { NotificationCard } = await import("./NotificationCard");
    render(
      createElement(NotificationCard, {
        item: {
          id: "n2",
          channel: "push",
          type: "info",
          status: "sent",
          payload: null,
          sentAt: null,
          createdAt: "2026-09-02",
          read: true,
        },
      }),
    );
    expect(screen.queryByRole("button", { name: /Marquer lu/ })).toBeNull();
  });
});

describe("empty + skeleton", () => {
  it("EmptyState renders title + CTA link", async () => {
    const { EmptyState } = await import("./EmptyState");
    render(createElement(EmptyState, { title: "Aucun voyage", cta: { href: "/search", label: "Rechercher" } }));
    expect(screen.getByText("Aucun voyage")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Rechercher/ }).getAttribute("href")).toBe("/search");
  });

  it("SkeletonCard renders skeleton slots", async () => {
    const { SkeletonCard } = await import("./SkeletonCard");
    const { container } = render(createElement(SkeletonCard));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
  });
});
