import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [mode, service] = process.argv.slice(2);
if (!["install", "build", "dev"].includes(mode) || !["api", "client", "event", "guest", "supplier"].includes(service)) {
  throw new Error("Usage: node scripts/vercel-service.mjs <install|build|dev> <api|client|event|guest|supplier>");
}

// Vercel runs every service install in one checkout, and npm ci deletes
// node_modules first. One full install shared by all services keeps earlier
// services' dependencies present when Vercel packages their functions.
if (mode === "install") {
  const lockHash = createHash("sha256").update(readFileSync(path.join(repoRoot, "package-lock.json"))).digest("hex");
  const marker = path.join(repoRoot, "node_modules", ".prism-vercel-install");
  if (existsSync(marker) && readFileSync(marker, "utf8") === lockHash) {
    console.log(`Reusing the shared workspace install for ${service}.`);
    process.exit(0);
  }
  const result = spawnSync("npm", ["ci", "--include=dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  writeFileSync(marker, lockHash);
  process.exit(0);
}

const serviceRoot = path.join(repoRoot, "apps", service);
const require = createRequire(path.join(serviceRoot, "package.json"));
const workspace = service === "api" ? "prism-api" : `@prism/${service}`;
const executable = mode === "build"
  ? require.resolve("turbo/bin/turbo")
  : require.resolve(service === "api" ? "@nestjs/cli/bin/nest.js" : "next/dist/bin/next");
const args = mode === "build"
  ? ["run", "build", `--filter=${workspace}...`]
  : service === "api"
    ? ["start", "api", "--watch"]
    : ["dev", "--port", process.env.PORT ?? "3000"];

// Only the Services entrypoints enable prefixes; existing standalone deployments
// and ordinary checkout launchers keep their current URLs and port ownership.
const child = spawn(process.execPath, [executable, ...args], {
  cwd: mode === "build" ? repoRoot : serviceRoot,
  env: { ...process.env, PRISM_VERCEL_SERVICES: "1" },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
