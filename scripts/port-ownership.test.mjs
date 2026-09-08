import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOwnedByThisCheckout } from "./port-ownership.cjs";

describe("port ownership proof", () => {
  it("prevents the primary checkout from claiming a worktree process", () => {
    assert.equal(
      isOwnedByThisCheckout(
        { commandLine: "node C:\\repo\\.worktrees\\alpha\\apps\\api\\main.js", executablePath: "C:\\nodejs\\node.exe" },
        "C:\\repo",
      ),
      false,
    );
  });

  it("prevents a worktree from claiming a primary process", () => {
    assert.equal(
      isOwnedByThisCheckout(
        { commandLine: "node C:\\repo\\apps\\api\\main.js", executablePath: "C:\\nodejs\\node.exe" },
        "C:\\repo\\.worktrees\\alpha",
      ),
      false,
    );
  });

  it("requires a path-component boundary for ownership", () => {
    assert.equal(
      isOwnedByThisCheckout({ commandLine: "node C:\\repo-two\\apps\\api\\main.js" }, "C:\\repo"),
      false,
    );
    assert.equal(
      isOwnedByThisCheckout({ commandLine: "node C:\\repo\\apps\\api\\main.js" }, "C:\\repo"),
      true,
    );
  });
});
