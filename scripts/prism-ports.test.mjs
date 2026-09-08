import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PRISM_APPS,
  PRISM_BASE_PORTS,
  corsOriginFor,
  derivePortOffset,
  isPrimaryCheckout,
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
