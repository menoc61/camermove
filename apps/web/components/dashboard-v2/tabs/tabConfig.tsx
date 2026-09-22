"use client";

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
import type { ComponentType } from "react";
import type { DashboardTabId, DataTabId } from "./DashboardTabs";
import {
  EventRowActions,
  HotelRowActions,
  InsuranceRowActions,
  ParcelRowActions,
  RentalRowActions,
  TripsCancelOnly,
} from "./rowActions";

export const TABS: { value: DashboardTabId; label: string; icon: typeof Bus }[] = [
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

export const EXPORT_ENDPOINTS: Record<DataTabId, string> = {
  trips: "/api/v1/bookings/export",
  hotels: "/api/v1/hotels/bookings/export",
  rentals: "/api/v1/rentals/bookings/export",
  parcels: "/api/v1/parcels/export",
  insurance: "/api/v1/insurance/policies/export",
  events: "/api/v1/events/bookings/export",
  payments: "/api/v1/payments/export",
  notifications: "/api/v1/me/notifications/export",
};

export interface TabActionConfig {
  statuses: string[];
  label: (row: Record<string, unknown>) => string;
  Action: ComponentType<{ id: string; token: string }>;
}

/** Which tabs offer quick pay/cancel actions, on which statuses, with what caption. */
export const TAB_ACTIONS: Partial<Record<DataTabId, TabActionConfig>> = {
  trips: {
    statuses: ["pending_payment", "confirmed"],
    label: (row) => `Réf. ${String(row.reference ?? row.id)}`,
    Action: TripsCancelOnly,
  },
  parcels: {
    statuses: ["registered"],
    label: (row) => String(row.trackingNumber ?? row.id),
    Action: ParcelRowActions,
  },
  hotels: {
    statuses: ["pending_payment"],
    label: (row) => String((row.hotel as { name?: string } | null)?.name ?? row.id),
    Action: HotelRowActions,
  },
  rentals: {
    statuses: ["pending_payment"],
    label: (row) => String((row.vehicle as { make?: string; model?: string } | null)?.make ?? row.id),
    Action: RentalRowActions,
  },
  events: {
    statuses: ["pending_payment"],
    label: (row) => String((row.event as { name?: string })?.name ?? row.id),
    Action: EventRowActions,
  },
  insurance: {
    statuses: ["pending_payment"],
    label: (row) => String(row.policyNumber ?? row.id),
    Action: InsuranceRowActions,
  },
};
