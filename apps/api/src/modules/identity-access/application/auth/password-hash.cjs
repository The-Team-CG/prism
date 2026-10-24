'use strict';

// Single password hash format for PRISM operator accounts:
//   scrypt$N=<cost>,r=<blockSize>,p=<parallelism>$<saltHex>$<derivedKeyHex>
// Parameters travel with every hash, so verification never guesses them and a
// future parameter change is a policy upgrade on sign-in, not a format change.
// Only this format is accepted: there is no legacy or plaintext branch.

const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_COST_N = 2 ** 20;
const MAX_BLOCK_SIZE_R = 32;
const MAX_PARALLELISM_P = 16;

// OWASP-listed scrypt setting (N=2^14, r=8, p=5), about 16 MiB of memory per hash.
const CURRENT_SCRYPT_PARAMS = Object.freeze({ N: 2 ** 14, r: 8, p: 5 });

function memoryLimit({ N, r, p }) {
  // Node/OpenSSL need about 128 * r * (N + p + 2) bytes; the margin keeps the limit above that.
  return 128 * r * (N + p + 2) + 1024 * 1024;
}

function isPowerOfTwo(value) {
  return Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;
}

function parseParams(segment) {
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(segment);
  if (!match) return null;
  const params = { N: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  const valid = isPowerOfTwo(params.N) && params.N <= MAX_COST_N
    && params.r >= 1 && params.r <= MAX_BLOCK_SIZE_R
    && params.p >= 1 && params.p <= MAX_PARALLELISM_P;
  return valid ? params : null;
}

function isHex(value, byteLength) {
  return /^[0-9a-f]+$/i.test(value) && value.length === byteLength * 2;
}

function formatScryptPasswordHash({ params, salt, derivedHex }) {
  return `${PREFIX}$N=${params.N},r=${params.r},p=${params.p}$${salt}$${derivedHex}`;
}

/** Returns null for anything that is not a well-formed hash in the current format. */
function parseScryptPasswordHash(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const params = parseParams(parts[1]);
  if (!params || !isHex(parts[2], SALT_BYTES) || !isHex(parts[3], KEY_LENGTH)) return null;
  return { params, salt: parts[2], derivedHex: parts[3] };
}

function paramsEqual(left, right) {
  return left.N === right.N && left.r === right.r && left.p === right.p;
}

/** True when the value is in the current format with the current target parameters. */
function isCurrentScryptPasswordHash(stored) {
  const parsed = parseScryptPasswordHash(stored);
  return parsed !== null && paramsEqual(parsed.params, CURRENT_SCRYPT_PARAMS);
}

async function deriveKey(password, salt, params) {
  return scrypt(password, salt, KEY_LENGTH, { N: params.N, r: params.r, p: params.p, maxmem: memoryLimit(params) });
}

async function hashScryptPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = await deriveKey(password, salt, CURRENT_SCRYPT_PARAMS);
  return formatScryptPasswordHash({ params: CURRENT_SCRYPT_PARAMS, salt, derivedHex: derived.toString('hex') });
}

/** Returns false for unrecognised stored values; it never compares plaintext. */
async function verifyScryptPassword(stored, candidate) {
  const parsed = parseScryptPasswordHash(stored);
  if (!parsed) return false;
  const expected = Buffer.from(parsed.derivedHex, 'hex');
  const actual = await deriveKey(candidate, parsed.salt, parsed.params);
  return timingSafeEqual(expected, actual);
}

module.exports = {
  CURRENT_SCRYPT_PARAMS,
  KEY_LENGTH,
  formatScryptPasswordHash,
  hashScryptPassword,
  isCurrentScryptPasswordHash,
  parseScryptPasswordHash,
  verifyScryptPassword,
};
