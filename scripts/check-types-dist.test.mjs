import test from "node:test";
import assert from "node:assert/strict";
import { inspectTypesDist } from "./check-types-dist.mjs";

test("the workspace has a usable generated types package", async () => {
  const result = await inspectTypesDist();
  assert.deepEqual(result.missing, []);
  assert.equal(result.stale, false);
});
