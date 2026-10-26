import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRISM_APPS,
  PRISM_BASE_PORTS,
  assignPortSlots,
  corsOriginFor,
  derivePortOffset,
  describeCheckout,
  isPrimaryCheckout,
  normalizeWorktreePath,
  parseWorktreeList,
  portalUrlsFor,
  resolvePort,
  resolvePortSet,
} from "./prism-ports.mjs";

describe("prism port resolution", () => {
  it("keeps the canonical ports in the primary checkout", () => {
    const ports = resolvePortSet({ worktreeRoot: "C:/repo", isPrimary: true });
    assert.deepEqual(ports, { ...PRISM_BASE_PORTS });
  });

  it("gives two worktrees non-overlapping port blocks", () => {
    const alpha = resolvePortSet({ worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false });
    const beta = resolvePortSet({ worktreeRoot: "C:/repo/.worktrees/beta", isPrimary: false });
    const used = new Set([...Object.values(alpha), ...Object.values(beta)]);
    assert.equal(used.size, PRISM_APPS.length * 2);
  });

  it("resolves the known w6/w20 hash collision with distinct blocks", () => {
    const paths = ["C:/repo/.worktrees/w6", "C:/repo/.worktrees/w20"];
    const slots = assignPortSlots(paths);
    assert.notEqual(slots["c:/repo/.worktrees/w6"], slots["c:/repo/.worktrees/w20"]);
    const blocks = paths.map((worktreeRoot) =>
      resolvePortSet({ worktreeRoot, isPrimary: false, worktreeSlot: slots[worktreeRoot.toLowerCase()] }),
    );
    assert.equal(new Set(blocks.flatMap((ports) => Object.values(ports))).size, PRISM_APPS.length * 2);
  });

  it("assigns the same normalized worktree set identically regardless of input order", () => {
    const first = assignPortSlots(["C:/repo/.worktrees/w20", "C:/repo/.worktrees/w6", "C:/repo/.worktrees/alpha"]);
    const second = assignPortSlots(["c:\\repo\\.worktrees\\alpha\\", "C:/repo/.worktrees/w6", "C:/repo/.worktrees/w20"]);
    assert.deepEqual(second, first);
  });

  it("preserves an existing colliding assignment when an earlier path is added", () => {
    const existing = assignPortSlots(["C:/repo/.worktrees/w20"]);
    const updated = assignPortSlots(["C:/repo/.worktrees/w6", "C:/repo/.worktrees/w20"], existing);
    assert.equal(updated["c:/repo/.worktrees/w20"], existing["c:/repo/.worktrees/w20"]);
    assert.notEqual(updated["c:/repo/.worktrees/w6"], updated["c:/repo/.worktrees/w20"]);
  });

  it("fails closed when more worktrees exist than available slots", () => {
    const paths = Array.from({ length: 49 }, (_, index) => `C:/repo/.worktrees/capacity-${index}`);
    assert.throws(() => assignPortSlots(paths), /No free P\.R\.I\.S\.M port slot/);
  });

  it("normalizes dot and dotdot path segments before assigning", () => {
    const normalized = assignPortSlots(["C:/repo/.worktrees/alpha/../beta", "C:/repo/.worktrees/beta"]);
    assert.equal(Object.keys(normalized).length, 1);
    assert.ok(normalized["c:/repo/.worktrees/beta"]);
  });

  it("treats separator, case, and trailing-slash variants as the same worktree", () => {
    const canonical = resolvePortSet({ worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false });
    const variant = resolvePortSet({ worktreeRoot: "c:\\repo\\.worktrees\\alpha\\", isPrimary: false });
    assert.deepEqual(variant, canonical);
  });

  it("never derives a port that collides across surfaces or reaches the ephemeral range", () => {
    for (let slot = 0; slot < 64; slot += 1) {
      const ports = resolvePortSet({ worktreeRoot: `C:/repo/.worktrees/w${slot}`, isPrimary: false });
      const values = Object.values(ports);
      assert.equal(new Set(values).size, values.length);
      for (const port of values) {
        assert.ok(port > 1024, `port ${port} is privileged`);
        assert.ok(port < 49152, `port ${port} is in the ephemeral range`);
      }
    }
  });

  it("lets an explicit per-app port win over a derived offset", () => {
    const port = resolvePort("client", {
      env: { PRISM_CLIENT_PORT: "3999" },
      worktreeRoot: "C:/repo/.worktrees/alpha",
      isPrimary: false,
    });
    assert.equal(port, 3999);
  });

  it("uses an explicit API PORT override consistently with the API wrapper", () => {
    assert.equal(resolvePort("api", {
      env: { PORT: "4555" },
      worktreeRoot: "C:/repo/.worktrees/alpha",
      isPrimary: false,
    }), 4555);
    assert.equal(resolvePort("api", {
      env: { PORT: "4555", PRISM_API_PORT: "4666" },
      worktreeRoot: "C:/repo/.worktrees/alpha",
      isPrimary: false,
    }), 4666);
  });

  it("filters missing and prunable worktree registrations before slot assignment", () => {
    const output = [
      "worktree C:/repo",
      "HEAD abc",
      "",
      "worktree C:/repo/.worktrees/missing",
      "HEAD def",
      "",
      "worktree C:/repo/.worktrees/prunable",
      "HEAD ghi",
      "prunable gitdir file points to missing location",
    ].join("\n");
    const paths = parseWorktreeList(output, (candidate) => candidate === "C:\\repo");
    assert.deepEqual(paths, ["C:\\repo"]);
  });

  it("lets an explicit offset override the derived one, including back to zero", () => {
    const options = { worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false };
    assert.equal(resolvePort("api", { ...options, env: { PRISM_PORT_OFFSET: "0" } }), 4000);
    assert.equal(resolvePort("api", { ...options, env: { PRISM_PORT_OFFSET: "70" } }), 4070);
  });

  it("rejects an unknown surface instead of inventing a port", () => {
    assert.throws(() => resolvePort("admin", { isPrimary: true }), /Unknown P.R.I.S.M app/);
  });

  it("builds a CORS origin list that matches the derived portal ports", () => {
    const ports = resolvePortSet({ worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false });
    assert.equal(
      corsOriginFor(ports),
      `http://localhost:${ports.client},http://localhost:${ports.supplier},http://localhost:${ports.guest},http://localhost:${ports.event}`,
    );
  });

  it("gives each portal its own origin on the port the launcher serves it from", () => {
    assert.deepEqual(portalUrlsFor(resolvePortSet({ isPrimary: true })), {
      NEXT_PUBLIC_CLIENT_PORTAL_URL: "http://localhost:3001",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3002",
      NEXT_PUBLIC_GUEST_PORTAL_URL: "http://localhost:3003",
      NEXT_PUBLIC_EVENT_PORTAL_URL: "http://localhost:3004",
    });
    const ports = resolvePortSet({ worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false });
    assert.deepEqual(portalUrlsFor(ports), {
      NEXT_PUBLIC_CLIENT_PORTAL_URL: `http://localhost:${ports.client}`,
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: `http://localhost:${ports.supplier}`,
      NEXT_PUBLIC_GUEST_PORTAL_URL: `http://localhost:${ports.guest}`,
      NEXT_PUBLIC_EVENT_PORTAL_URL: `http://localhost:${ports.event}`,
    });
  });

  it("detects a linked worktree from the git directory layout", () => {
    assert.equal(isPrimaryCheckout({ gitDir: "C:/repo/.git", gitCommonDir: "C:/repo/.git" }), true);
    assert.equal(
      isPrimaryCheckout({ gitDir: "C:/repo/.git/worktrees/alpha", gitCommonDir: "C:/repo/.git" }),
      false,
    );
  });

  it("only offsets linked worktrees", () => {
    assert.equal(derivePortOffset({ worktreeRoot: "C:/repo", isPrimary: true }), 0);
    assert.ok(derivePortOffset({ worktreeRoot: "C:/repo/.worktrees/alpha", isPrimary: false }) > 0);
  });
});

describe("checkout discovery", () => {
  /**
   * `npm --workspace <app> run dev` runs the dev script from the workspace
   * folder rather than the repo root. git reports `--git-dir` and
   * `--git-common-dir` relative to the cwd, so resolving them against the
   * worktree root used to land above the repo and mislabel the primary
   * checkout as a linked worktree -- which then failed with
   * "No persisted port slot for linked worktree".
   */
  it("identifies the same checkout from any working directory inside it", () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const baseline = describeCheckout(repoRoot);
    const nestedDirs = ["scripts", "apps/api", "apps/event", "packages/types"]
      .map((relative) => path.join(repoRoot, relative))
      .filter((candidate) => fs.existsSync(candidate));

    assert.ok(nestedDirs.length > 0, "expected nested workspace directories to inspect");
    for (const cwd of nestedDirs) {
      const nested = describeCheckout(cwd);
      assert.equal(
        normalizeWorktreePath(nested.worktreeRoot),
        normalizeWorktreePath(baseline.worktreeRoot),
        `worktree root drifted when resolved from ${cwd}`,
      );
      assert.equal(nested.isPrimary, baseline.isPrimary, `checkout kind drifted when resolved from ${cwd}`);
    }
  });
});

describe("portal origins", () => {
  it("builds every portal origin from the live port set", () => {
    assert.deepEqual(portalUrlsFor({ api: 4010, client: 3011, supplier: 3012, guest: 3013, event: 3014 }), {
      NEXT_PUBLIC_CLIENT_PORTAL_URL: "http://localhost:3011",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3012",
      NEXT_PUBLIC_GUEST_PORTAL_URL: "http://localhost:3013",
      NEXT_PUBLIC_EVENT_PORTAL_URL: "http://localhost:3014",
    });
  });
});
