import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = join(root, "packages", "types", "src");
const distRoot = join(root, "packages", "types", "dist");
const requiredOutputs = ["index.js", "index.d.ts"];

async function fileMtime(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(child);
  }
  return files;
}

export async function inspectTypesDist() {
  const sourceFiles = await walk(sourceRoot);
  const sourceMtimes = await Promise.all(sourceFiles.map(fileMtime));
  const sourceMtime = Math.max(...sourceMtimes.filter((mtime) => mtime !== null));
  const outputMtimes = await Promise.all(requiredOutputs.map((file) => fileMtime(join(distRoot, file))));
  const missing = requiredOutputs.filter((_, index) => outputMtimes[index] === null);
  const distMtime = Math.min(...outputMtimes.filter((mtime) => mtime !== null));

  return {
    sourceFiles,
    sourceMtime,
    distMtime: Number.isFinite(distMtime) ? distMtime : null,
    missing,
    stale: missing.length > 0 || !Number.isFinite(sourceMtime) || !Number.isFinite(distMtime) || sourceMtime > distMtime,
  };
}

const result = await inspectTypesDist();
if (result.stale) {
  const reason = result.missing.length > 0
    ? `missing ${result.missing.join(", ")}`
    : "generated output is older than packages/types/src";
  console.error(`[types-dist] stale @prism/types dist: ${reason}.`);
  console.error("Run: npm --workspace @prism/types run build");
  process.exitCode = 1;
} else {
  console.log("[types-dist] @prism/types dist is present and newer than source.");
}
