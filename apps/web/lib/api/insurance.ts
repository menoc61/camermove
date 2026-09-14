function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export type CoverageType = "basic" | "standard" | "premium" | "family"

export interface InsurancePolicy {
  id: string
  providerName: string
  coverageType: CoverageType
  destination: string
  startDate: string
  endDate: string
  travelers: number
  premium: number
  currency: string
  status: string
  policyNumber: string | null
  documentUrl: string | null
  createdAt: string
}

export interface SubscribeInsuranceBody {
  destination: string
  startDate: string
  endDate: string
  travelersCount: number
  coverageType: CoverageType
}

export interface InsurancePoliciesResponse {
  items: InsurancePolicy[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface InsurancePoliciesParams {
  page?: number
  perPage?: number
  q?: string
  coverageType?: CoverageType
  dateFrom?: string
  dateTo?: string
}

// Paginated envelope — matches GET /api/v1/insurance/policies at runtime.
// Callers must read `.items` (see app/insurance/page.tsx and the dashboard insurance tab).
export async function fetchInsurancePolicies(
  token: string,
  params: InsurancePoliciesParams = {},
): Promise<InsurancePoliciesResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.perPage) qs.set("perPage", String(params.perPage))
  if (params.q) qs.set("q", params.q)
  if (params.coverageType) qs.set("coverageType", params.coverageType)
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom)
  if (params.dateTo) qs.set("dateTo", params.dateTo)
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchMyInsurancePolicies(
  token: string,
  params: InsurancePoliciesParams = {},
): Promise<InsurancePoliciesResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.perPage) qs.set("perPage", String(params.perPage))
  if (params.q) qs.set("q", params.q)
  if (params.coverageType) qs.set("coverageType", params.coverageType)
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom)
  if (params.dateTo) qs.set("dateTo", params.dateTo)
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function subscribeInsurance(
  token: string,
  body: SubscribeInsuranceBody
): Promise<InsurancePolicy> {
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchInsurancePolicy(token: string, id: string): Promise<InsurancePolicy> {
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies/${id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function cancelInsurancePolicy(token: string, id: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface CreateInsurancePaymentOpts {
  provider?: "notchpay" | "cinetpay"
  method?: "mobile_money" | "card" | "bank_transfer"
  phone?: string
  email?: string
}

export async function createInsurancePayment(
  token: string,
  policyId: string,
  opts: CreateInsurancePaymentOpts = {},
  idempotencyKey?: string
): Promise<{ payment?: unknown; authorizationUrl?: string | null; paymentUrl?: string | null }> {
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies/${policyId}/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey || crypto.randomUUID(),
    },
    body: JSON.stringify({
      provider: opts.provider ?? "notchpay",
      ...(opts.method ? { method: opts.method } : {}),
      ...(opts.phone ? { phone: opts.phone } : {}),
      ...(opts.email ? { email: opts.email } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const COVERAGE_LABELS: Record<CoverageType, string> = {
  basic: "Basique",
  standard: "Standard",
  premium: "Premium",
  family: "Famille",
}

export const COVERAGE_PRICES: Record<CoverageType, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
}
