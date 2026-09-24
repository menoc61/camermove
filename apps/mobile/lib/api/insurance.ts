import { request, resourceClient } from "./resource";

export type CoverageType = "basic" | "standard" | "premium" | "family";

export interface InsurancePolicy {
  id: string;
  providerName: string;
  coverageType: CoverageType;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  premium: number;
  currency: string;
  status: string;
  policyNumber: string | null;
  documentUrl: string | null;
  createdAt: string;
}

export interface SubscribeInsuranceBody {
  destination: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  coverageType: CoverageType;
}

export interface InsurancePoliciesResponse {
  items: InsurancePolicy[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface InsurancePoliciesParams {
  page?: number;
  perPage?: number;
  q?: string;
  coverageType?: CoverageType;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

const insurance = resourceClient<InsurancePolicy>("/api/v1/insurance/policies");

export function fetchInsurancePolicies(
  token: string,
  params: InsurancePoliciesParams = {}
): Promise<InsurancePoliciesResponse> {
  return request<InsurancePoliciesResponse>("/api/v1/insurance/policies", {
    token,
    params: {
      ...params,
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
    },
  });
}

export function fetchMyInsurancePolicies(
  token: string,
  params: InsurancePoliciesParams = {}
): Promise<InsurancePoliciesResponse> {
  return request<InsurancePoliciesResponse>("/api/v1/insurance/policies", {
    token,
    params: {
      ...params,
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
    },
  });
}

export function subscribeInsurance(
  token: string,
  body: SubscribeInsuranceBody
): Promise<InsurancePolicy> {
  return request<InsurancePolicy>("/api/v1/insurance/policies", { method: "POST", token, body });
}

export function fetchInsurancePolicy(token: string, id: string): Promise<InsurancePolicy> {
  return request<InsurancePolicy>(`/api/v1/insurance/policies/${encodeURIComponent(id)}`, { token });
}

export function cancelInsurancePolicy(token: string, id: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/v1/insurance/policies/${encodeURIComponent(id)}/cancel`, { method: "POST", token });
}

export interface CreateInsurancePaymentOpts {
  provider?: "notchpay" | "cinetpay";
  method?: "mobile_money" | "card" | "bank_transfer";
  phone?: string;
  email?: string;
}

export function createInsurancePayment(
  token: string,
  policyId: string,
  opts: CreateInsurancePaymentOpts = {},
): Promise<{ payment?: unknown; authorizationUrl?: string | null; paymentUrl?: string | null }> {
  return request(`/api/v1/insurance/policies/${encodeURIComponent(policyId)}/pay`, {
    method: "POST",
    token,
    body: {
      provider: opts.provider ?? "notchpay",
      ...(opts.method ? { method: opts.method } : {}),
      ...(opts.phone ? { phone: opts.phone } : {}),
      ...(opts.email ? { email: opts.email } : {}),
    },
  });
}

export const COVERAGE_LABELS: Record<CoverageType, string> = {
  basic: "Basique",
  standard: "Standard",
  premium: "Premium",
  family: "Famille",
};

export const COVERAGE_PRICES: Record<CoverageType, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
};