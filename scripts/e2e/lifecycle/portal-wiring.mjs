// Static "is this API capability reachable from a portal" checks. Portals call the API through @prism/api-client, so a
// route usually appears only inside the client library; a portal reaches it by calling the client method that wraps it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const APP_DIRS = { event: "apps/event/src", client: "apps/client/src", guest: "apps/guest/src", supplier: "apps/supplier/src" };

function sourceFiles(dir) {
  const out = [];
  const walk = (current) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push({ path, text: readFileSync(path, "utf8") });
    }
  };
  walk(join(repoRoot, dir));
  return out;
}

const corpus = new Map();
const filesOf = (dir) => {
  if (!corpus.has(dir)) corpus.set(dir, sourceFiles(dir));
  return corpus.get(dir);
};

/**
 * Each client-library method with its group and the code that implements it: group "lifecycle", name
 * "recordActualEnd" for `lifecycle: { recordActualEnd: (eventId, …) => prismRequest(…) }`.
 */
let methods;
function clientMethods() {
  if (methods) return methods;
  methods = [];
  for (const file of filesOf("packages/api-client/src")) {
    let group = null;
    let current = null;
    for (const line of file.text.split(/\r?\n/)) {
      const opens = line.match(/^\s{2,6}([a-zA-Z][a-zA-Z0-9]*)\s*:\s*\{\s*$/);
      if (opens) { group = opens[1]; current = null; continue; }
      const start = line.match(/^\s{4,}([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(?:async\s*)?\(/);
      if (start && group) { current = { group, name: start[1], body: "" }; methods.push(current); }
      if (current) current.body += `${line}\n`;
    }
  }
  return methods;
}

/** "group.method" for each client-library method whose implementation matches the route pattern. */
export function clientMethodsFor(route) {
  return [...new Set(clientMethods().filter((method) => route.test(method.body)).map((method) => `${method.group}.${method.name}`))];
}

/**
 * Files in a portal that reach the route: either they spell the route themselves (older direct calls) or they call
 * a client-library method that does. A call through the client reads "<group>.<method>(" (eventApi.lifecycle
 * .recordActualEnd(…)), so a common method name such as replace or logs counts only on its own group, never on an
 * unrelated string or array method.
 */
export function portalCallers(app, route) {
  const names = clientMethodsFor(route).map((name) => name.replace(".", "\\s*\\.\\s*"));
  const call = names.length ? new RegExp(`\\b(?:${names.join("|")})\\(`) : null;
  return filesOf(APP_DIRS[app])
    .filter((file) => route.test(file.text) || (call && call.test(file.text)))
    .map((file) => file.path.slice(repoRoot.length + 1).replace(/\\/g, "/"));
}
