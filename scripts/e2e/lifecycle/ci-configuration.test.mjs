import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createCIEnvironment } from "./prepare-ci.mjs";
import { hasFailedChecks } from "./report-result.mjs";

test("CI refuses hosted and normal development databases before preparing credentials", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  for (const url of ["postgresql://user@hosted.example/prism_e2e_flow", "postgresql://user@localhost/postgres"]) {
    assert.throws(() => createCIEnvironment(url, root), /loopback prism_e2e_flow/);
  }
  const env = createCIEnvironment("postgresql://user@127.0.0.1:55439/prism_e2e_flow", root);
  assert.equal(env.DIRECT_URL, "");
  assert.equal(env.PRISM_MAIL_TRANSPORT, "log");
  assert.equal(env.PRISM_STORAGE_PROVIDER, "local");
  assert.equal(env.E2E_STRICT, "1");
  const passwords = Object.entries(env).filter(([key]) => key.startsWith("PRISM_SEED_PASSWORD_")).map(([, value]) => value);
  assert.equal(new Set(passwords).size, 4);
  assert.ok(passwords.every(value => value.length >= 24));
});

test("strict CI fails every unresolved result while exploratory runs retain their policy", () => {
  assert.equal(hasFailedChecks({ PASS: 477 }, true), false);
  assert.equal(hasFailedChecks({ REVIEW: 1 }), false);
  for (const status of ["FAIL", "HARNESS_ERROR", "GAP", "BLOCKED", "REVIEW"]) assert.equal(hasFailedChecks({ [status]: 1 }, true), true);
});
