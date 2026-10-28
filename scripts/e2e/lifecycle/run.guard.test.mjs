import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cases = [
  ["refuses a remote API before making requests", { E2E_API_URL: "https://example.invalid/api" }, /isolated local API/],
  ["refuses the normal development API", { E2E_API_URL: "http://localhost:4000/api" }, /isolated local API/],
  ["refuses the normal development database", { DATABASE_URL: "postgresql://unused@127.0.0.1:54322/postgres" }, /isolated local prism_e2e_flow/],
  ["refuses a hosted database behind a local API URL", { DATABASE_URL: "postgresql://unused@example.invalid:5432/prism_e2e_flow" }, /isolated local prism_e2e_flow/],
  ["requires private actor credentials before making requests", {}, /Supply the admin password/],
];

for (const [name, overrides, message] of cases) {
  test(name, () => {
    const env = { ...process.env, E2E_API_URL: "http://localhost:4100/api", DATABASE_URL: "postgresql://unused@127.0.0.1:54322/prism_e2e_flow" };
    for (const key of Object.keys(env)) {
      if (key.startsWith("E2E_PASSWORD_") || key.startsWith("PRISM_SEED_PASSWORD_")) delete env[key];
    }
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./run.mjs", import.meta.url))], { env: { ...env, ...overrides }, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stdout, /Lifecycle e2e against/);
  });
}
