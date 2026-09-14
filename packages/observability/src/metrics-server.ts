import { createServer, type Server } from "node:http"
import { register } from "prom-client"
import type { Env } from "@camermove/config"

/**
 * Minimal /metrics + /health server for processes without an HTTP framework
 * (e.g. worker, plus optional standalone metrics port for the API).
 *
 * - `GET /metrics` → prom-client default `register` output
 * - `GET /health`  → 200 OK (used by orchestrator probes)
 * - everything else → 404
 *
 * The returned object exposes a `close()` Promise that resolves once the
 * underlying http server has finished draining — callers wire it into their
 * SIGTERM/SIGINT shutdown path for graceful shutdown.
 */
export interface MetricsServer {
  server: Server
  port: number
  close(): Promise<void>
}

export function startMetricsServer(env: Pick<Env, "METRICS_PORT">): MetricsServer {
  const port = env.METRICS_PORT
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/metrics") {
        const body = await register.metrics()
        res.writeHead(200, { "Content-Type": register.contentType })
        res.end(body)
        return
      }
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "ok" }))
        return
      }
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("not found")
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" })
      res.end(`metrics error: ${(err as Error).message}`)
    }
  })
  server.listen(port)
  const close = (): Promise<void> =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  return { server, port, close }
}
