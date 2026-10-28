#!/usr/bin/env node
// Lifecycle e2e: walks a PMCM event from public inquiry to archive through the real HTTP API, as each role,
// and reports where the product passes, fails, is blocked by an earlier failure, or simply has a gap.
//
//   E2E_API_URL=http://localhost:4100/api E2E_API_LOG=<api log file> node scripts/e2e/lifecycle/run.mjs [--only a,b]
//
// The API must run with PRISM_MAIL_TRANSPORT=log (activation links are read from its log) against a disposable
// database that already has the seeded accounts (`npm --workspace prism-api run db:seed -- --profile accounts`).
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cfg, conflicts, http, results, summary } from "./lib.mjs";
import { createContext } from "./ctx.mjs";
import { hasFailedChecks } from "./report-result.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(",") : null;
const reportDir = process.env.E2E_REPORT_DIR ?? join(here, "..", "..", "..", ".local-dev", "e2e-report");

const target = new URL(cfg.api);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.port !== "4100") {
  throw new Error("This mutating suite requires the isolated local API on port 4100.");
}
let database;
try { database = new URL(process.env.DATABASE_URL); }
catch { throw new Error("Load the disposable database configuration from a private env file."); }
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.pathname !== "/prism_e2e_flow") {
  throw new Error("This mutating suite requires the isolated local prism_e2e_flow database.");
}
for (const [actor, password] of Object.entries(cfg.password)) {
  if (!password) throw new Error(`Supply the ${actor} password through a private env file.`);
}

console.log(`Lifecycle e2e against ${cfg.api}${process.env.E2E_TARGET_LABEL ? ` (${process.env.E2E_TARGET_LABEL})` : ""}`);
const health = await http("GET", "/../health").catch(() => ({ status: 0 }));
if (health.status !== 200) {
  console.error(`API did not answer ${cfg.api}/../health with 200 (got ${health.status}). Start it first.`);
  process.exit(2);
}

const ctx = createContext();
const files = readdirSync(join(here, "phases")).filter((f) => f.endsWith(".mjs")).sort();
for (const file of files) {
  const phase = await import(pathToFileURL(join(here, "phases", file)).href);
  const id = file.replace(/^\d+-/, "").replace(/\.mjs$/, "");
  if (only && !only.includes(id)) continue;
  try {
    await phase.run(ctx);
  } catch (error) {
    results.push({ phase: phase.name ?? id, name: "phase crashed", status: "FAIL", detail: error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : String(error) });
    console.log(`FAIL    phase ${id} crashed -> ${error instanceof Error ? error.message : error}`);
  }
}

if (conflicts.length) {
  const grouped = Object.entries(conflicts.reduce((acc, c) => ({ ...acc, [c.replace(/ \(attempt \d+\)/, "")]: (acc[c.replace(/ \(attempt \d+\)/, "")] ?? 0) + 1 }), {}));
  console.log(`Retried after the API aborted a request with a database error: ${conflicts.length} time(s)`);
  grouped.forEach(([k, n]) => console.log(`  ${n}x ${k}`));
  results.push({ phase: "Database retries", name: "database failures retried through explicit exploratory opt-in", status: "FAIL", detail: grouped.map(([k, n]) => `${n}x ${k}`).join("; ") });
}
const counts = summary();
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, "latest.json"), JSON.stringify({ api: cfg.api, database: { host: database.hostname, port: database.port, name: database.pathname.slice(1) }, at: new Date().toISOString(), counts, results }, null, 2));
const by = (status) => results.filter((r) => r.status === status);
const section = (title, rows) => rows.length ? `\n## ${title} (${rows.length})\n${rows.map((r) => `- **${r.phase}: ${r.name}**: ${String(r.detail).replace(/\n/g, " ")}`).join("\n")}\n` : "";
writeFileSync(join(reportDir, "latest.md"), `# Lifecycle e2e report\n\nTarget: ${cfg.api}\nGenerated: ${new Date().toISOString()}\n\n${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}\n\nThese are API assertions and labelled source scans, not browser acceptance or a percentage of product completion. Phases use separate events to isolate destructive probes. The local filesystem storage adapter is exercised; hosted Storage, pooler behavior and delivery providers are not. A FAIL is an observed assertion failure that still needs contract review before being called a product bug.\n${section("Failed assertions", by("FAIL"))}${section("Harness errors", by("HARNESS_ERROR"))}${section("Unavailable paths and coverage gaps", by("GAP"))}${section("Blocked by an earlier failure", by("BLOCKED"))}`);
writeFileSync(join(reportDir, "latest.md"), section("Business rules and API contracts to review", by("REVIEW")), { flag: "a" });
console.log(`Report: ${join(reportDir, "latest.md")}`);
process.exit(hasFailedChecks(counts, process.env.E2E_STRICT === "1") ? 1 : 0);
