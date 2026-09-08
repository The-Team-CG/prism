import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import ownership from "./port-ownership.cjs";

const {
  isOwnedByThisCheckout,
  leaseForProcessChain,
  leaseMatchesProcess,
  ownershipFromLeases,
  readCheckoutLeases,
  removeCheckoutLease,
  writeCheckoutLease,
} = ownership;

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

  it("uses the durable lease when node_modules resolves into the primary checkout", () => {
    const lease = { ownerRoot: "c:/repo/.worktrees/alpha", app: "api", pid: 42, startTime: 1234 };
    const process = { pid: 42, startTime: 1234, executablePath: "c:/repo/node_modules/node.exe" };
    assert.equal(leaseMatchesProcess(lease, process), true);
    assert.equal(ownershipFromLeases(process, "C:/repo/.worktrees/alpha", [lease]), "owned");
    assert.equal(ownershipFromLeases(process, "C:/repo", [lease]), "foreign");
  });

  it("finds a supervisor lease through a listening descendant ancestry", () => {
    const lease = { ownerRoot: "c:/repo/.worktrees/alpha", app: "api", pid: 41, startTime: 1111 };
    const supervisor = { pid: 41, startTime: 1111, parentPid: 10 };
    const listener = { pid: 99, startTime: 2222, parentPid: 41, executablePath: "c:/repo/node_modules/node.exe" };
    const match = leaseForProcessChain([listener, supervisor], [lease], "api");
    assert.equal(match.lease, lease);
    assert.equal(match.process, supervisor);
    const directLease = { ownerRoot: "c:/repo/.worktrees/alpha", app: "client", pid: 99, startTime: 2222 };
    assert.equal(leaseForProcessChain([listener], [directLease], "client").process, listener);
    assert.equal(leaseForProcessChain([listener, supervisor], [lease, directLease], "supplier"), null);
  });

  it("classifies ownership using the requested app when lease identities collide", () => {
    const process = { pid: 77, startTime: 3333 };
    const clientLease = { ownerRoot: "c:/repo", app: "client", pid: 77, startTime: 3333 };
    const apiLease = { ownerRoot: "c:/repo/.worktrees/alpha", app: "api", pid: 77, startTime: 3333 };
    assert.equal(ownershipFromLeases(process, "C:/repo", [clientLease, apiLease], "api"), "foreign");
    assert.equal(ownershipFromLeases(process, "C:/repo/.worktrees/alpha", [clientLease, apiLease], "api"), "owned");
  });

  it("rejects stale or reused PID markers", () => {
    const lease = { ownerRoot: "c:/repo/.worktrees/alpha", pid: 42, startTime: 1234 };
    assert.equal(ownershipFromLeases({ pid: 42, startTime: 9999 }, "C:/repo/.worktrees/alpha", [lease]), "unknown");
    assert.equal(ownershipFromLeases({ pid: 43, startTime: 1234 }, "C:/repo/.worktrees/alpha", [lease]), "unknown");
  });

  it("does not remove a replacement lease written by a newer wrapper", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prism-lease-race-"));
    try {
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      const first = writeCheckoutLease({ ownerRoot: root, app: "api", identity: { pid: 101, startTime: 1001 } });
      const replacement = writeCheckoutLease({ ownerRoot: root, app: "api", identity: { pid: 202, startTime: 2002 } });
      assert.equal(removeCheckoutLease({ ownerRoot: root, app: "api", lease: first }), false);
      assert.equal(readCheckoutLeases(root)[0].leaseToken, replacement.leaseToken);
      assert.equal(removeCheckoutLease({ ownerRoot: root, app: "api", lease: replacement }), true);
      assert.deepEqual(readCheckoutLeases(root), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
