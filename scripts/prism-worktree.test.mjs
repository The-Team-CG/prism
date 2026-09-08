import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertInsideWorktrees,
  collectLinkedDirectories,
  planEnvFiles,
  prepareWorktree,
  removeWorktreeTree,
  upsertEnvLines,
} from "./prism-worktree.mjs";

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prism-worktree-test-"));
  fs.mkdirSync(path.join(root, "node_modules", "dep"), { recursive: true });
  fs.writeFileSync(path.join(root, "node_modules", "dep", "index.js"), "// real dependency\n");
  return root;
}

describe("worktree path containment", () => {
  it("accepts a worktree directory and rejects anything outside it", () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, ".worktrees"), { recursive: true });
      assert.equal(assertInsideWorktrees(repo, path.join(repo, ".worktrees", "alpha")), path.resolve(repo, ".worktrees", "alpha"));
      assert.throws(() => assertInsideWorktrees(repo, path.join(repo, ".worktrees")), /Refusing to touch/);
      assert.throws(() => assertInsideWorktrees(repo, path.join(repo, "apps", "api")), /Refusing to touch/);
      assert.throws(() => assertInsideWorktrees(repo, path.join(repo, ".worktrees", "..", "elsewhere")), /Refusing to touch/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("refuses a .worktrees root junction and leaves the external canary untouched", () => {
    const repo = makeRepo();
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "prism-worktree-external-root-"));
    const canary = path.join(external, "canary.txt");
    fs.writeFileSync(canary, "preserve me\n");
    try {
      fs.symlinkSync(external, path.join(repo, ".worktrees"), "junction");
      assert.throws(() => assertInsideWorktrees(repo, path.join(repo, ".worktrees", "alpha")), /symlink|junction|outside/i);
      assert.equal(fs.readFileSync(canary, "utf8"), "preserve me\n");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it("refuses a worktree root that is a junction", () => {
    const repo = makeRepo();
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "prism-worktree-external-"));
    const worktrees = path.join(repo, ".worktrees");
    const junction = path.join(worktrees, "alpha");
    try {
      fs.mkdirSync(worktrees, { recursive: true });
      fs.symlinkSync(external, junction, "junction");
      assert.throws(() => assertInsideWorktrees(repo, junction), /symlink|junction/i);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it("refuses to delete a tree outside .worktrees", () => {
    const repo = makeRepo();
    try {
      assert.throws(() => removeWorktreeTree(repo, path.join(repo, "node_modules")), /Refusing to touch/);
      assert.ok(fs.existsSync(path.join(repo, "node_modules", "dep", "index.js")));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("junction-safe worktree removal", () => {
  it("unlinks junctions instead of following them into the real dependency tree", () => {
    const repo = makeRepo();
    const worktree = path.join(repo, ".worktrees", "alpha");
    const canary = path.join(repo, "node_modules", "dep", "index.js");
    try {
      fs.mkdirSync(path.join(worktree, "node_modules"), { recursive: true });
      fs.symlinkSync(path.join(repo, "node_modules", "dep"), path.join(worktree, "node_modules", "dep"), "junction");
      assert.deepEqual(collectLinkedDirectories(worktree), [path.join(worktree, "node_modules", "dep")]);

      const result = removeWorktreeTree(repo, worktree);

      assert.equal(result.links, 1);
      assert.equal(result.unlinked, 1);
      assert.equal(fs.existsSync(worktree), false);
      assert.equal(fs.readFileSync(canary, "utf8"), "// real dependency\n");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("worktree env preparation", () => {
  it("replaces an existing key and appends a missing one without disturbing the rest", () => {
    const original = "# comment\nPORT=4000\nDB_SSL=true\n";
    const next = upsertEnvLines(original, { PORT: 4310, CORS_ORIGIN: "http://localhost:3311" });
    assert.match(next, /^# comment$/m);
    assert.match(next, /^PORT=4310$/m);
    assert.match(next, /^DB_SSL=true$/m);
    assert.match(next, /^CORS_ORIGIN=http:\/\/localhost:3311$/m);
    assert.equal(next.match(/^PORT=/gm).length, 1);
  });

  it("collapses duplicate regex-special keys and preserves replacement dollar signs", () => {
    const next = upsertEnvLines("A.B=old\nA.B=duplicate\nKEEP=yes\n", { "A.B": "$1-$&" });
    assert.equal(next, "A.B=$1-$&\nKEEP=yes\n");
    assert.equal(next.match(/^A\.B=/gm).length, 1);
  });

  it("plans the API port plus one API URL per portal", () => {
    const ports = { api: 4310, client: 3311, supplier: 3312, guest: 3313, event: 3314 };
    const plan = planEnvFiles(ports);
    const files = plan.map((entry) => entry.file.replace(/\\/g, "/"));
    assert.deepEqual(files, [
      "apps/api/.env",
      "apps/client/.env.local",
      "apps/supplier/.env.local",
      "apps/guest/.env.local",
      "apps/event/.env.local",
    ]);
    assert.equal(plan[0].entries.PORT, 4310);
    assert.equal(plan[1].entries.NEXT_PUBLIC_API_URL, "http://localhost:4310");
    assert.equal(plan[1].entries.NEXT_PUBLIC_EVENT_PORTAL_URL, "http://localhost:3314");
    assert.equal(plan[1].entries.NEXT_PUBLIC_SUPPLIER_PORTAL_URL, "http://localhost:3312");
    assert.equal(plan[1].entries.NEXT_PUBLIC_CLIENT_ORIGIN, "http://localhost:3311");
  });

  it("seeds examples by default and copies local credentials only with opt-in", () => {
    const primary = makeRepo();
    const target = makeRepo();
    const ports = { api: 4310, client: 3311, supplier: 3312, guest: 3313, event: 3314 };
    try {
      fs.mkdirSync(path.join(primary, "apps", "api"), { recursive: true });
      fs.mkdirSync(path.join(primary, "apps", "client"), { recursive: true });
      fs.writeFileSync(path.join(primary, "apps", "api", ".env"), "DATABASE_URL=LOCAL_SECRET\n");
      fs.writeFileSync(path.join(primary, "apps", "api", ".env.example"), "DATABASE_URL=EXAMPLE\n");
      fs.writeFileSync(path.join(primary, "apps", "client", ".env.example"), "NEXT_PUBLIC_API_URL=EXAMPLE\n");
      prepareWorktree({ worktreeRoot: target, primaryRoot: primary, ports });
      assert.match(fs.readFileSync(path.join(target, "apps", "api", ".env"), "utf8"), /DATABASE_URL=EXAMPLE/);
      assert.doesNotMatch(fs.readFileSync(path.join(target, "apps", "api", ".env"), "utf8"), /LOCAL_SECRET/);

      const optedIn = makeRepo();
      try {
        prepareWorktree({ worktreeRoot: optedIn, primaryRoot: primary, ports, copyLocalEnv: true });
        assert.match(fs.readFileSync(path.join(optedIn, "apps", "api", ".env"), "utf8"), /DATABASE_URL=LOCAL_SECRET/);
      } finally {
        fs.rmSync(optedIn, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(primary, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
