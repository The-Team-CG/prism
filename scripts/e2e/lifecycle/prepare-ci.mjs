import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createCIEnvironment(databaseUrl, root) {
  const database = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || database.pathname !== "/prism_e2e_flow") {
    throw new Error("CI requires a loopback prism_e2e_flow database.");
  }
  const migrations = readdirSync(join(root, "apps/api/prisma/migrations")).filter(name => /^\d+_/.test(name)).sort();
  const env = {
    DATABASE_URL: databaseUrl, DIRECT_URL: "", SUPABASE_DB_URL: "", PRISMA_DATABASE_URL: "", SHADOW_DATABASE_URL: "",
    PRISM_LOCAL_DEV: "", DB_SSL: "false", DB_SSL_CA_FILE: "", NODE_ENV: "development", PRISM_SEED_ENV: "local",
    PRISM_SCHEMA_REQUIRED_HEAD: migrations.at(-1), PORT: "4100", PRISM_TRUST_PROXY: "true",
    PRISM_MAIL_TRANSPORT: "log", PRISM_SESSION_SECRET: randomBytes(32).toString("hex"), PRISM_SESSION_TTL_SECONDS: "28800",
    PRISM_STORAGE_PROVIDER: "local", PRISM_STORAGE_LOCAL_DIRECTORY: join(root, ".local-dev/lifecycle-ci-storage"),
    PRISM_CLIENT_PORTAL_URL: "http://localhost:3001", PRISM_SUPPLIER_PORTAL_URL: "http://localhost:3002",
    PRISM_EVENT_PORTAL_URL: "http://localhost:3004", AI_PROVIDER: "mock", AI_ROUTE_PROFILE: "mock", PARE_MODE: "mock",
    PRISM_DISABLE_CONFORME_REMINDER_JOB: "true", E2E_API_URL: "http://localhost:4100/api", E2E_STRICT: "1",
    E2E_API_LOG: join(root, ".local-dev/lifecycle-ci-api.log"), E2E_SECRETS_FILE: join(root, ".local-dev/lifecycle-ci-secrets.json"),
  };
  for (const actor of ["ADMIN", "CLIENT", "COORDINATOR", "SUPPLIER"]) env[`PRISM_SEED_PASSWORD_${actor}`] = randomBytes(24).toString("hex");
  return env;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_ENV) throw new Error("Run this setup only in GitHub Actions.");
  const root = process.cwd();
  const env = createCIEnvironment(process.env.DATABASE_URL, root);
  mkdirSync(join(root, ".local-dev"), { recursive: true });
  const path = join(root, ".local-dev/lifecycle-ci.env");
  for (const [key, value] of Object.entries(env)) if (/PASSWORD|SECRET/.test(key)) console.log(`::add-mask::${value}`);
  writeFileSync(path, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  appendFileSync(process.env.GITHUB_ENV, `PRISM_ENV_FILE=${path}\nE2E_API_LOG=${env.E2E_API_LOG}\n`);
}
