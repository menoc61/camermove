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

export async function fetchInsurancePolicies(token: string): Promise<InsurancePolicy[]> {
  const res = await fetch(`${apiBase()}/api/v1/insurance/policies`, {
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
