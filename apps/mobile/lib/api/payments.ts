import { resourceClient } from "./resource";

const payments = resourceClient("/api/v1/payments");

export interface MyPaymentItem {
  id: string;
  provider: string;
  providerRef: string | null;
  amount: number;
  method: string | null;
  currency: string;
  status: string;
  createdAt: string;
  bookingId: string;
}

export interface MyPaymentsResponse {
  items: MyPaymentItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchMyPayments(token: string, params: Record<string, string> = {}): Promise<MyPaymentsResponse> {
  return payments.list("", { token, params }) as Promise<MyPaymentsResponse>;
}
