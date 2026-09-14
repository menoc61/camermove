import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import type { Env } from "@camermove/config"
export function initTelemetry(env: Env) {
  const enabled = env.METRICS_ENABLED
  if (env.NODE_ENV === "test" || !enabled) return { shutdown: async () => {} }
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318"
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }) }),
    instrumentations: [getNodeAutoInstrumentations()],
  })
  sdk.start()
  return { shutdown: async () => { await sdk.shutdown() } }
}
