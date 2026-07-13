import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sum, clamp } from "./sum.mjs";

describe("practice sum", () => {
  it("adds numbers", () => {
    assert.equal(sum(2, 3), 5);
  });
});

describe("practice clamp", () => {
  it("clamps below min", () => {
    assert.equal(clamp(-1, 0, 10), 0);
  });
  it("clamps above max", () => {
    assert.equal(clamp(99, 0, 10), 10);
  });
  it("keeps in range", () => {
    assert.equal(clamp(5, 0, 10), 5);
  });
});