import { Counter, Histogram, Registry } from "prom-client"
const registry = new Registry()
const opsCounter = new Counter({ name: "camermove_operations_total", help: "Operations counter", labelNames: ["name", "route"], registers: [registry] })
const errorCounter = new Counter({ name: "camermove_error_total", help: "Error counter", labelNames: ["name"], registers: [registry] })
const opDuration = new Histogram({ name: "camermove_operation_duration_ms", help: "Operation duration ms", labelNames: ["name"], registers: [registry] })
export function resetMetrics() { registry.clear() }
export function readMetricsSummary(): string { return registry.metrics() as unknown as string }
export async function observe<T>(name: string, attrs: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try { return await fn() } catch (err) { errorCounter.inc({ name }); throw err } finally { opDuration.observe({ name }, performance.now() - start); opsCounter.inc({ name, route: attrs.route ?? "" }) }
}
export { registry }
