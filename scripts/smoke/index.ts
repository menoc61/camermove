import { smokeAuth } from "./auth"
import { smokeSearch } from "./search"

const suites: Record<string, () => Promise<void>> = {
  auth: smokeAuth,
  search: smokeSearch,
}

async function runAll() {
  console.log("Running all smoke suites…\n")
  for (const [name, fn] of Object.entries(suites)) {
    console.log(`\n=== ${name} ===`)
    await fn()
  }
  console.log("\n✓ all smoke suites passed")
}

const target = process.argv[2]

if (!target || target === "all") {
  runAll().catch((e) => {
    console.error(e)
    process.exit(1)
  })
} else if (suites[target]) {
  suites[target]!().catch((e) => {
    console.error(e)
    process.exit(1)
  })
} else {
  console.error(`Unknown suite "${target}". Available: ${Object.keys(suites).join(", ")}, all`)
  process.exit(1)
}
