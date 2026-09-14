import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  oxc: false,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"],
    // Default 5s is too tight when several workers cold-import jsdom + recharts
    // in parallel (observed 19s for a single dynamic import under full load).
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["lib/api/**/*.ts", "components/dashboard-v2/**/*.{ts,tsx}"],
      exclude: ["lib/api/**/*.test.{ts,tsx}", "components/dashboard-v2/**/*.test.{ts,tsx}"],
    },
  },
});
