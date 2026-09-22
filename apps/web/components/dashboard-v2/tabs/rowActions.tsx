"use client";

import { useState, type ComponentType } from "react";
import type { Column } from "../panels";
import { CancelButton } from "../controls/CancelButton";
import { cancelBooking } from "@/lib/api/bookings";
import { cancelHotelBooking, createHotelPayment } from "@/lib/api/hotels";
import { cancelParcel, createParcelPayment } from "@/lib/api/parcels";
import { cancelRentalBooking, createRentalPayment } from "@/lib/api/rentals";
import { cancelEventBooking, createEventBookingPayment } from "@/lib/api/events";
import { cancelInsurancePolicy, createInsurancePayment } from "@/lib/api/insurance";

type PayFn = (id: string, token: string) => Promise<{ paymentUrl?: string | null; authorizationUrl?: string | null }>;
type CancelFn = (token: string, id: string) => Promise<unknown>;

/**
 * Shared pay-then-cancel row action: "Payer" redirects to the provider URL,
 * "Annuler" confirms via CancelButton and invalidates the tab queries.
 */
export function PayCancelActions({
  id,
  token,
  pay,
  cancel,
  invalidateKeys,
}: {
  id: string;
  token: string;
  pay: PayFn;
  cancel: CancelFn;
  invalidateKeys: string[][];
}) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  async function onPay() {
    setPaying(true);
    setPayError(null);
    try {
      const res = await pay(id, token);
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
        onClick={onPay}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {paying ? "Paiement…" : "Payer"}
      </button>
      {payError ? <span role="alert" className="text-xs text-destructive">{payError}</span> : null}
      <CancelButton visible onCancel={() => cancel(token, id)} invalidateKeys={invalidateKeys} />
    </div>
  );
}

function makeActions(
  pay: PayFn,
  cancel: CancelFn,
  invalidateKeys: string[][],
) {
  return function RowActions({ id, token }: { id: string; token: string }) {
    return <PayCancelActions id={id} token={token} pay={pay} cancel={cancel} invalidateKeys={invalidateKeys} />;
  };
}

export function TripsCancelOnly({ id, token }: { id: string; token: string }) {
  return (
    <CancelButton
      visible
      onCancel={() => cancelBooking(String(id), token)}
      invalidateKeys={[["dashboard-trips"], ["dashboard-v2"]]}
    />
  );
}

export const ParcelRowActions = makeActions(
  (id, token) => createParcelPayment(id, token),
  cancelParcel,
  [["dashboard-parcels"], ["dashboard-v2"]],
);

export const HotelRowActions = makeActions(
  (id, token) => createHotelPayment(token, id, { provider: "notchpay" }),
  cancelHotelBooking,
  [["dashboard-hotels"], ["dashboard-v2"]],
);

export const RentalRowActions = makeActions(
  (id, token) => createRentalPayment(token, id, { provider: "notchpay" }),
  cancelRentalBooking,
  [["dashboard-rentals"], ["dashboard-v2"]],
);

export const EventRowActions = makeActions(
  (id, token) => createEventBookingPayment(id, token),
  cancelEventBooking,
  [["dashboard-events"], ["dashboard-v2"]],
);

export const InsuranceRowActions = makeActions(
  (id, token) => createInsurancePayment(token, id, {}),
  cancelInsurancePolicy,
  [["dashboard-insurance"], ["dashboard-v2"]],
);

/** Builds a per-row `Actions` column from a TAB_ACTIONS entry. Rows whose
 * status is not actionable render an empty cell. */
export function rowActionsColumn(
  config: { statuses: string[]; label: (row: Record<string, unknown>) => string; Action: ComponentType<{ id: string; token: string }> },
  token: string,
): Column {
  return {
    key: "__actions",
    label: "Actions",
    sortable: false,
    render: (_v, row) => {
      if (!config.statuses.includes(String(row.status))) return null;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-mono text-xs text-muted-foreground">{config.label(row)}</span>
          <config.Action id={String(row.id)} token={token} />
        </div>
      );
    },
  };
}
