import { describe, it, expect } from "vitest"
import { observe, resetMetrics, readMetricsSummary } from "./metrics"
describe("observe", () => {
  it("records a counter after an op", async () => {
    resetMetrics()
    await observe("test.op", { route: "search" }, async () => "ok")
    const summary = await readMetricsSummary()
    expect(summary).toContain("camermove_operations_total")
  })
  it("increments error counter on failure", async () => {
    resetMetrics()
    await expect(observe("fail.op", {}, async () => { throw new Error("boom") })).rejects.toThrow("boom")
    const summary = await readMetricsSummary()
    expect(summary).toContain("camermove_error_total")
  })
})
