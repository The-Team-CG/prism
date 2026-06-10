import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const files = execFileSync("git", ["ls-files", "apps", "packages"], {
  cwd: root,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

const rules = [
  {
    name: "client app must not import event app internals",
    filePattern: /^apps\/client\//,
    importPattern: /from\s+["'](?:apps\/event|@prism\/event)/,
  },
  {
    name: "event app must not import client app internals",
    filePattern: /^apps\/event\//,
    importPattern: /from\s+["'](?:apps\/client|@prism\/client)/,
  },
  {
    name: "shared ui must not import app-local modules",
    filePattern: /^packages\/ui\//,
    importPattern: /from\s+["'](?:@\/|apps\/)/,
  },
  {
    name: "shared types must not import React or app modules",
    filePattern: /^packages\/types\//,
    importPattern: /from\s+["'](?:react|@\/|apps\/|@prism\/ui)/,
  },
  {
    name: "api client must not import role app modules",
    filePattern: /^packages\/api-client\//,
    importPattern: /from\s+["'](?:@\/|apps\/)/,
  },
];

const violations = [];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  const source = readFileSync(join(root, file), "utf8");

  for (const rule of rules) {
    if (rule.filePattern.test(normalized) && rule.importPattern.test(source)) {
      violations.push(`${normalized}: ${rule.name}`);
    }
  }
}

if (violations.length > 0) {
  console.error("P.R.I.S.M boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`P.R.I.S.M boundary check passed for ${files.length} files.`);
