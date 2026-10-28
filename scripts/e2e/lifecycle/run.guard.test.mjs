import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { conflicts, http } from "./lib.mjs";

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

test("database-error retries require opt-in and remain visible after recovery", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  const databaseError = () => new Response(JSON.stringify({ message: "A database request failed." }), { status: 500 });
  fetch.mock.mockImplementation(databaseError);
  const initialConflicts = conflicts.length;

  assert.equal((await http("GET", "/retry-probe")).status, 500);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(conflicts.length, initialConflicts);

  fetch.mock.mockImplementationOnce(databaseError);
  fetch.mock.mockImplementation(() => new Response(JSON.stringify({ recovered: true }), { status: 200 }));
  try {
    const recovered = await http("GET", "/retry-probe", { retryDatabaseErrors: true });
    assert.equal(recovered.status, 200);
    assert.deepEqual(recovered.body, { recovered: true });
    assert.equal(fetch.mock.callCount(), 3);
    assert.deepEqual(conflicts.slice(initialConflicts), ["GET /retry-probe (attempt 1)"]);
  } finally {
    conflicts.splice(initialConflicts);
  }
});
