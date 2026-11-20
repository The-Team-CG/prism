'use strict';

// Content hash used to pin a client's review (decision, note, payload) to the exact snapshot they saw.
// Shared by the review service and the floorplan conversion script: both must produce the same value.

const { createHash } = require('node:crypto');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

module.exports = { canonicalHash };
