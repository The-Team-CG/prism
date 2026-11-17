import assert from "node:assert/strict";
import { test } from "node:test";
import { blockingAdvisories } from "../npm-audit-ci.mjs";

const advisory = (url, severity) => ({ url, severity, title: url.split("/").pop() });
const report = (...advisories) => ({
  vulnerabilities: {
    picomatch: { via: advisories },
    vite: { via: ["picomatch"] },
  },
});
const exemptions = [{ advisory: "https://github.com/advisories/GHSA-exempt", reason: "no fix yet", until: "2026-12-18" }];

test("an exempted advisory passes until its date, then fails again", () => {
  const exempted = report(advisory("https://github.com/advisories/GHSA-exempt", "high"));
  assert.deepEqual(blockingAdvisories(exempted, "2026-12-18", exemptions), []);
  assert.equal(blockingAdvisories(exempted, "2026-12-19", exemptions).length, 1);
});

test("any other moderate or worse advisory still fails, and low ones never do", () => {
  const mixed = report(
    advisory("https://github.com/advisories/GHSA-exempt", "high"),
    advisory("https://github.com/advisories/GHSA-other", "moderate"),
    advisory("https://github.com/advisories/GHSA-minor", "low"),
  );
  assert.deepEqual(blockingAdvisories(mixed, "2026-11-18", exemptions).map((entry) => entry.url), ["https://github.com/advisories/GHSA-other"]);
});
