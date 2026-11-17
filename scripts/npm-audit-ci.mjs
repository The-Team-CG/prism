import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Advisories CI tolerates for a while, each with the reason and a date after which it fails CI again. Keep this list
 * empty unless an advisory has no fixed release; every other advisory at moderate or above still fails CI.
 */
export const TEMPORARY_EXEMPTIONS = [
  {
    advisory: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
    reason: "picomatch ReDoS in dev tooling (vite, vitest, typescript-eslint); no fixed release exists yet and nothing in the portals or API uses it at runtime.",
    until: "2026-12-18",
  },
];

const BLOCKING = new Set(["moderate", "high", "critical"]);

/** The advisories npm reports, each with its severity: the objects in every vulnerability's `via`. */
function advisoriesOf(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const cause of vulnerability.via ?? []) {
      if (typeof cause === "object" && cause.url) found.set(cause.url, { url: cause.url, title: cause.title, severity: cause.severity });
    }
  }
  return [...found.values()];
}

/** Which blocking advisories fail the audit on `today` (YYYY-MM-DD): any not exempted, or exempted past its date. */
export function blockingAdvisories(report, today, exemptions = TEMPORARY_EXEMPTIONS) {
  const exempt = new Map(exemptions.filter((entry) => today <= entry.until).map((entry) => [entry.advisory, entry]));
  return advisoriesOf(report).filter((advisory) => BLOCKING.has(advisory.severity) && !exempt.has(advisory.url));
}

function auditReport() {
  try {
    return JSON.parse(execFileSync("npm", ["audit", "--json"], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 }));
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the report is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const blocking = blockingAdvisories(auditReport(), today);
  for (const entry of TEMPORARY_EXEMPTIONS) {
    console.log(`${today <= entry.until ? "Exempt" : "EXPIRED exemption"} until ${entry.until}: ${entry.advisory} (${entry.reason})`);
  }
  if (blocking.length === 0) {
    console.log("npm audit: no blocking advisories.");
    return;
  }
  for (const advisory of blocking) console.error(`${advisory.severity}: ${advisory.title} ${advisory.url}`);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
