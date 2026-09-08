import { Counter, Histogram, Registry } from "prom-client"
// All metrics are registered on the prom-client default register (registers
// omitted) so fastify-metrics merges everything into a single /metrics endpoint.
const registry = new Registry() // kept for isolated test summaries
const opsCounter = new Counter({ name: "camermove_operations_total", help: "Operations counter", labelNames: ["name", "route"] })
const errorCounter = new Counter({ name: "camermove_error_total", help: "Error counter", labelNames: ["name"] })
const opDuration = new Histogram({ name: "camermove_operation_duration_ms", help: "Operation duration ms", labelNames: ["name"] })

function boundedLabel(value: unknown, max = 48): string {
  const s = String(value ?? "unknown").trim().toLowerCase().slice(0, max)
  return s.length > 0 ? s : "unknown"
}

const searchRequests = new Counter({
  name: "search_requests_total",
  help: "Interurban search requests by origin/destination",
  labelNames: ["origin", "destination"],
})

const bookingsTotal = new Counter({
  name: "bookings_total",
  help: "Booking lifecycle events",
  labelNames: ["status"],
})

const paymentsTotal = new Counter({
  name: "payments_total",
  help: "Payment attempts by provider and outcome",
  labelNames: ["provider", "outcome"],
})

const parcelsTotal = new Counter({
  name: "parcels_total",
  help: "Parcel status transitions",
  labelNames: ["status"],
})

const eventTicketsTotal = new Counter({
  name: "event_tickets_total",
  help: "Event tickets sold",
  labelNames: ["event"],
})

const insuranceSubscriptionsTotal = new Counter({
  name: "insurance_subscriptions_total",
  help: "Insurance policies subscribed",
  labelNames: ["coverage"],
})

export function observeSearch(origin: unknown, destination: unknown): void {
  searchRequests.inc({ origin: boundedLabel(origin), destination: boundedLabel(destination) })
}
export function observeBooking(status: unknown): void {
  bookingsTotal.inc({ status: boundedLabel(status, 24) })
}
export function observePayment(provider: unknown, outcome: unknown): void {
  paymentsTotal.inc({ provider: boundedLabel(provider, 24), outcome: boundedLabel(outcome, 24) })
}
export function observeParcel(status: unknown): void {
  parcelsTotal.inc({ status: boundedLabel(status, 24) })
}
export function observeEventTicket(event: unknown): void {
  eventTicketsTotal.inc({ event: boundedLabel(event) })
}
export function observeInsurance(coverage: unknown): void {
  insuranceSubscriptionsTotal.inc({ coverage: boundedLabel(coverage, 24) })
}

export function resetMetrics() {
  opsCounter.reset()
  errorCounter.reset()
  opDuration.reset()
  searchRequests.reset()
  bookingsTotal.reset()
  paymentsTotal.reset()
  parcelsTotal.reset()
  eventTicketsTotal.reset()
  insuranceSubscriptionsTotal.reset()
}
export async function readMetricsSummary(): Promise<string> {
  const { register } = await import("prom-client")
  return register.metrics()
}
export async function observe<T>(name: string, attrs: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try { return await fn() } catch (err) { errorCounter.inc({ name }); throw err } finally { opDuration.observe({ name }, performance.now() - start); opsCounter.inc({ name, route: attrs.route ?? "" }) }
}
export { registry }
