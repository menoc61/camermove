import { describe, it, expect } from "vitest"
import { observe, resetMetrics, readMetricsSummary } from "./metrics"
describe("observe", () => {
  it("records a counter after an op", async () => {
    resetMetrics()
    await observe("test.op", { route: "search" }, async () => "ok")
    const summary = await readMetricsSummary()
    expect(summary).toContain("camermove_operations_total")
  })
})
