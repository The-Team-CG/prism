#!/usr/bin/env node
// Copies the Pascal editor's assets into a portal's public folder: icons, cursor, lighting, sounds and material textures
// from packages/floorplan-canvas/assets/pascal, and the KTX2 Basis transcoder from three. The copies are gitignored;
// see packages/floorplan-canvas/assets/pascal/README.md.
//   node scripts/sync-pascal-assets.mjs <event|client>
import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORTALS = new Set(["event", "client"]);
const ENTRIES = ["icons", "cursor.svg", "hdri", "audios", "material"];

const app = process.argv[2];
if (!PORTALS.has(app)) {
  console.error(`Usage: sync-pascal-assets.mjs <${[...PORTALS].join("|")}>`);
  process.exit(1);
}

const source = join(root, "packages", "floorplan-canvas", "assets", "pascal");
const target = join(root, "apps", app, "public");
for (const entry of ENTRIES) {
  rmSync(join(target, entry), { recursive: true, force: true });
  cpSync(join(source, entry), join(target, entry), { recursive: true });
}

// three exports no package.json; its main entry sits in build/, one level under the package.
const three = resolve(dirname(createRequire(join(root, "packages", "floorplan-canvas", "package.json")).resolve("three")), "..");
const basis = join(three, "examples", "jsm", "libs", "basis");
if (!existsSync(join(basis, "basis_transcoder.wasm"))) throw new Error(`three's Basis transcoder is missing at ${basis}`);
rmSync(join(target, "basis"), { recursive: true, force: true });
cpSync(basis, join(target, "basis"), { recursive: true });

console.log(`[sync-pascal-assets] copied Pascal assets into apps/${app}/public`);
