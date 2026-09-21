import { smokeAuth } from "./auth.js";
import { smokeSearch } from "./search.js";
import { smokeTickets } from "../smoke-tickets.js";
import { smokeDashboard } from "../smoke-dashboard.js";
import { smokeVerticals } from "./verticals.js";
import { smokeExports } from "./exports.js";

type Suite = "auth" | "search" | "tickets" | "dashboard" | "verticals" | "exports";

const suites: Record<Suite, () => Promise<void>> = {
  auth: smokeAuth,
  search: smokeSearch,
  tickets: smokeTickets,
  dashboard: smokeDashboard,
  verticals: smokeVerticals,
  exports: smokeExports,
};

async function runOne(name: Suite) {
  console.log(`\n=== ${name} ===`);
  await suites[name]();
  console.log(`\n✔ ${name} smoke passed`);
}

async function runAll() {
  console.log("CamerMove — unified smoke runner\n");
  await runOne("auth");
  await runOne("search");
  await runOne("tickets");
  await runOne("dashboard");
  await runOne("verticals");
  await runOne("exports");
  console.log("\n✔ all smoke suites passed");
}

const target = (process.argv[2] ?? "all") as Suite;

if (target === "all") {
  runAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (suites[target]) {
  runOne(target).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  console.error(
    `Unknown suite "${target}". Available: ${Object.keys(suites).join(", ")}, all`
  );
  process.exit(1);
}
