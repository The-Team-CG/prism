// Shared helpers for the lifecycle e2e runner. Talks only to the public HTTP API, so the same
// journey runs only against the isolated local API/database accepted by the runner guard.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const cfg = {
  api: (process.env.E2E_API_URL ?? "http://localhost:4100/api").replace(/\/$/, ""),
  apiLog: process.env.E2E_API_LOG ?? "",
  secretsFile: process.env.E2E_SECRETS_FILE ?? "",
  password: {
    admin: process.env.E2E_PASSWORD_ADMIN ?? process.env.PRISM_SEED_PASSWORD_ADMIN,
    client: process.env.E2E_PASSWORD_CLIENT ?? process.env.PRISM_SEED_PASSWORD_CLIENT,
    coordinator: process.env.E2E_PASSWORD_COORDINATOR ?? process.env.PRISM_SEED_PASSWORD_COORDINATOR,
    supplier: process.env.E2E_PASSWORD_SUPPLIER ?? process.env.PRISM_SEED_PASSWORD_SUPPLIER,
  },
};

// Public routes are rate limited per client address. With PRISM_TRUST_PROXY=true the API reads X-Forwarded-For, so
// each request presents its own address (as real users behind the proxy do) and parallel runners do not throttle
// each other. Pass { sameIp: true } to test the limiter itself. Ignored by APIs that do not trust the proxy.
const randomIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

/** Requests the API aborted with a database error and that the harness retried. Reported, never hidden. */
export const conflicts = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function http(method, path, options = {}) {
  let result = await httpOnce(method, path, options);
  for (let attempt = 1; attempt <= 8 && options.retryDatabaseErrors === true && result.status === 500 && /database request failed/i.test(JSON.stringify(result.body ?? "")) && !options.raw; attempt++) {
    conflicts.push(`${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")} (attempt ${attempt})`);
    await sleep(100 + Math.random() * 300 * attempt);
    result = await httpOnce(method, path, options);
  }
  return result;
}

async function httpOnce(method, path, { token, body, headers = {}, raw = false, sameIp = false } = {}) {
  const res = await fetch(`${cfg.api}${path}`, {
    method,
    signal: AbortSignal.timeout(30_000),
    headers: { ...(sameIp ? {} : { "x-forwarded-for": randomIp() }), ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) return { status: res.status, bytes: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  const unwrapped = json && typeof json === "object" && !Array.isArray(json) && "data" in json && Object.keys(json).length === 1 ? json.data : json;
  return { status: res.status, body: unwrapped };
}

export const msg = (r) => (r.body && typeof r.body === "object" ? r.body.message ?? JSON.stringify(r.body) : String(r.body)).toString().slice(0, 220);

// --- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) --------------------------------------------------------
function base32(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out = [];
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
export function totp(secret, offset = 0) {
  const counter = Math.floor(Date.now() / 30000) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32(secret)).update(buf).digest();
  const o = hmac[hmac.length - 1] & 15;
  return String((hmac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const secrets = () => (cfg.secretsFile && existsSync(cfg.secretsFile) ? JSON.parse(readFileSync(cfg.secretsFile, "utf8")) : {});
const saveSecret = (email, secret) => { if (cfg.secretsFile) writeFileSync(cfg.secretsFile, JSON.stringify({ ...secrets(), [email]: secret })); };

/** Signs in, completing 2FA setup or a 2FA challenge when the account requires it. Returns { token, user } or { error }. */
async function signIn(email, password) {
  let r = await http("POST", "/auth/login", { body: { email, password } });
  if (r.status !== 200) return { error: `login ${r.status}: ${msg(r)}` };
  if (r.body.accessToken) return { token: r.body.accessToken, user: r.body };
  if (r.body.kind === "two_factor_setup_required") {
    const setup = await http("POST", "/auth/2fa/setup", { body: { token: r.body.token } });
    if (setup.status !== 200) return { error: `2fa setup ${setup.status}: ${msg(setup)}` };
    saveSecret(email, setup.body.secret);
    const verify = await http("POST", "/auth/2fa/verify", { body: { token: setup.body.token ?? r.body.token, code: totp(setup.body.secret) } });
    return verify.body?.accessToken ? { token: verify.body.accessToken, user: verify.body } : { error: `2fa verify ${verify.status}: ${msg(verify)}` };
  }
  if (r.body.kind === "two_factor_required" || r.body.kind === "two_factor_challenge") {
    const secret = secrets()[email];
    if (!secret) return { error: "account needs a 2FA code and no secret is stored (set E2E_SECRETS_FILE)" };
    // A code works once, so a parallel run that used this window's code makes the API refuse ours: try the next windows.
    let verify;
    for (const offset of [0, 1, 2, 3]) {
      if (offset > 1) await sleep(30_000);
      const challenge = offset === 0 ? r.body.token : (await http("POST", "/auth/login", { body: { email, password } })).body?.token;
      verify = await http("POST", "/auth/2fa/verify", { body: { token: challenge, code: totp(secret, Math.min(offset, 1)) } });
      if (verify.body?.accessToken) break;
    }
    return verify.body?.accessToken ? { token: verify.body.accessToken, user: verify.body } : { error: `2fa challenge ${verify.status}: ${msg(verify)}` };
  }
  return { error: `unexpected login result: ${JSON.stringify(r.body).slice(0, 160)}` };
}

export async function login(email, password) {
  const result = await signIn(email, password);
  if (!result.token) return result;
  if (result.user?.privacyNoticeRequired) {
    const { PRISM_PRIVACY_NOTICE_VERSION } = await import("@prism/types");
    const ack = await http("POST", "/auth/privacy-notice/acknowledge", { token: result.token, body: { version: PRISM_PRIVACY_NOTICE_VERSION } });
    if (ack.status >= 300) return { error: `privacy notice acknowledgement ${ack.status}: ${msg(ack)}` };
    if (ack.body?.accessToken) return { token: ack.body.accessToken, user: ack.body };
  }
  return result;
}

// --- Emailed links, read from the API log (PRISM_MAIL_TRANSPORT=log) -----------------------------
export function mailsTo(email, since = 0) {
  if (!cfg.apiLog || !existsSync(cfg.apiLog)) return [];
  const text = readFileSync(cfg.apiLog, "utf8").replace(/\u001b\[[0-9;]*m/g, "");
  const parts = text.split(/(?=Mail to )/g).slice(since ? since : 0);
  return parts.filter((p) => p.startsWith(`Mail to ${email}`));
}
export const mailCount = () => (cfg.apiLog && existsSync(cfg.apiLog) ? (readFileSync(cfg.apiLog, "utf8").match(/Mail to /g) ?? []).length : 0);
/** Wait for the asynchronous outbox worker, without retrying any failed business command. */
export async function waitForMail(email, predicate, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const mail = mailsTo(email).find(predicate);
    if (mail) return mail;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  return "";
}

export function latestMailTo(email) { const m = mailsTo(email); return m[m.length - 1] ?? ""; }
export function tokenFromMail(mail) {
  const m = mail.match(/[?&]token=([A-Za-z0-9_\-.~%]{32,})/) ?? mail.match(/\/(?:activate|conforme|quote)[^\s]*?([A-Za-z0-9_\-]{32,})/);
  return m ? decodeURIComponent(m[1]) : "";
}

// --- Step recording -----------------------------------------------------------------------------
export const results = [];
let phase = "";
export const startPhase = (name) => { phase = name; console.log(`\n== ${name}`); };

/**
 * Runs one step. `fn` returns a string (pass detail), or throws. Use `blocked(reason)` when an earlier step
 * left nothing to work with, and `gap(reason)` when the product itself cannot do the step yet.
 */
export class Blocked extends Error {}
export class Gap extends Error {}
export class Review extends Error {}
export const blocked = (reason) => { throw new Blocked(reason); };
export const gap = (reason) => { throw new Gap(reason); };
export const review = (reason) => { throw new Review(reason); };

export async function step(name, fn) {
  let status = "PASS", detail = "";
  try {
    detail = (await fn()) ?? "";
  } catch (error) {
    if (error instanceof Blocked) { status = "BLOCKED"; detail = error.message; }
    else if (error instanceof Gap) { status = "GAP"; detail = error.message; }
    else if (error instanceof Review) { status = "REVIEW"; detail = error.message; }
    else { status = error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError ? "HARNESS_ERROR" : "FAIL"; detail = error instanceof Error ? error.message : String(error); }
  }
  results.push({ phase, name, status, detail });
  const tag = { PASS: "PASS   ", FAIL: "FAIL   ", BLOCKED: "BLOCKED", GAP: "GAP    ", REVIEW: "REVIEW ", HARNESS_ERROR: "HARNESS_ERROR" }[status];
  console.log(`${tag} ${name}${detail ? "  -> " + String(detail).slice(0, 230) : ""}`);
  return status === "PASS";
}

/** Asserts inside a step; the message becomes the failure detail. */
export function expect(condition, message) { if (!condition) throw new Error(message); }
export function expectStatus(r, ...ok) { if (!ok.includes(r.status)) throw new Error(`${r.status}: ${msg(r)}`); return r.body; }

export function summary() {
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log(`\n${results.length} steps: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  return counts;
}
