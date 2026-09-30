import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_DISPOSABLE_DATABASE = 'prism_sample_disposable';
export const DEV_RESET_KEY_HEADER = 'x-prism-dev-reset-key';
const DEFAULT_API_URL = 'http://localhost:4000';

function isLoopbackHost(hostname) {
  // Mirror the server guard for early refusal; the API check remains authoritative.
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '::1') return true;

  const octets = normalized.split('.').map(Number);
  return octets.length === 4 && octets[0] === 127 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function confirmDisposableDatabase(args) {
  if (
    args.length !== 2 ||
    args[0] !== '--confirm-disposable-db' ||
    args[1] !== SAMPLE_DISPOSABLE_DATABASE
  ) {
    throw new Error(`Confirm the target with --confirm-disposable-db ${SAMPLE_DISPOSABLE_DATABASE}.`);
  }
}

function parseLocalApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PRISM_API_URL must be a valid loopback HTTP(S) URL.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !isLoopbackHost(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  ) {
    throw new Error(
      'PRISM_API_URL must point directly to a loopback API host without credentials or extra path, query, or fragment.',
    );
  }

  return url;
}

export async function resetSampleFixtures({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  confirmDisposableDatabase(args);

  const apiUrl = parseLocalApiUrl((env.PRISM_API_URL || DEFAULT_API_URL).trim());
  const resetKey = env.PRISM_DEV_RESET_KEY?.trim();
  if (!resetKey) throw new Error('Set PRISM_DEV_RESET_KEY in apps/api/.env before resetting local fixtures.');

  const response = await fetchImpl(new URL('/api/sample/reset', apiUrl.origin), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      [DEV_RESET_KEY_HEADER]: resetKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Sample fixture reset was refused by the local API (HTTP ${response.status}). Confirm its runtime database is a loopback ${SAMPLE_DISPOSABLE_DATABASE} database.`,
    );
  }

  return true;
}

async function main() {
  await resetSampleFixtures();
  console.log(`Sample fixtures reset in ${SAMPLE_DISPOSABLE_DATABASE}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Sample fixture reset failed.');
    process.exitCode = 1;
  });
}
