import { createServer, type Server } from "node:http"
import { register } from "prom-client"
import { createLogger, type Env } from "@camermove/config"

const log = createLogger()

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
 *
 * Port contention (parallel test workers, dev double-starts) degrades
 * gracefully: if the port is already bound, the process keeps running and
 * metrics are served by whichever listener owns the port — an unhandled
 * 'error' event must never crash the whole app.
 */
export interface MetricsServer {
  server: Server
  port: number
  close(): Promise<void>
}

export function startMetricsServer(env: Pick<Env, "METRICS_PORT">, portOverride?: number): MetricsServer {
  const port = portOverride ?? env.METRICS_PORT
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
  server.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      log.warn({ port }, "metrics port already in use — another listener owns it, continuing without standalone metrics server")
    } else {
      log.error({ err: (err as Error).message, port }, "metrics server error")
    }
  })
  server.listen(port)
  const close = (): Promise<void> =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  return { server, port, close }
}
