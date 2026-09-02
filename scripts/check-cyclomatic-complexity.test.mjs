import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findComplexityViolations, isProductionSource, measureSource } from "./check-cyclomatic-complexity.mjs";

describe("cyclomatic complexity gate", () => {
  it("treats tests and shadcn copies as out of production scope", () => {
    assert.equal(isProductionSource("apps/api/src/modules/live-ops/application/live-operations.service.ts"), true);
    assert.equal(isProductionSource("apps/api/src/modules/live-ops/application/live-operations.service.test.ts"), false);
    assert.equal(isProductionSource("apps/client/src/app/components/ui/button.tsx"), false);
  });

  it("counts McCabe decisions the same way as ESLint complexity", () => {
    const [fn] = measureSource(
      "sample.ts",
      `
      export function score(value: number, flag: boolean) {
        if (value > 10) return "high";
        if (value > 5 && flag) return "mid";
        return flag ? "low" : "none";
      }
      `,
    );
    assert.equal(fn.name, "score");
    assert.equal(fn.complexity, 5);
  });

  it("counts nested functions separately instead of inflating the parent", () => {
    const functions = measureSource(
      "nested.ts",
      `
      export function outer(items: number[]) {
        return items.filter((item) => item > 0 && item < 10);
      }
      `,
    );
    const outer = functions.find((fn) => fn.name === "outer");
    const inner = functions.find((fn) => fn.name === "<anonymous>");
    assert.equal(outer.complexity, 1);
    assert.equal(inner.complexity, 2);
  });

  it("flags functions above the acceptable ceiling", () => {
    const violations = findComplexityViolations(
      [
        { file: "a.ts", name: "ok", complexity: 10, line: 1 },
        { file: "b.ts", name: "hot", complexity: 11, line: 4 },
      ],
      10,
    );
    assert.deepEqual(
      violations.map((item) => item.name),
      ["hot"],
    );
  });
});
