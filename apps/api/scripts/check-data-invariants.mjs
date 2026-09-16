import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

const { Pool } = pg;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const API_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const DEFAULT_DECLARATIONS_PATH = resolve(API_ROOT, 'prisma', 'data-invariants.json');
const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;
const DEFAULT_SAMPLE_LIMIT = 10;
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const FORBIDDEN_KEYWORDS = /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|MERGE|CALL|DO|VACUUM|REFRESH)\b/i;

function scanSql(sql) {
  let clean = '';
  const semicolonPositions = [];
  let state = 'normal';
  let dollarTag = '';

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (state === 'line-comment') {
      if (character === '\n' || character === '\r') {
        state = 'normal';
        clean += character;
      } else {
        clean += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        state = 'normal';
        clean += '  ';
        index += 1;
      } else {
        clean += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'single-quote') {
      if (character === '\\' && next !== undefined) {
        clean += '  ';
        index += 1;
      } else if (character === "'" && next === "'") {
        clean += '  ';
        index += 1;
      } else if (character === "'") {
        state = 'normal';
        clean += ' ';
      } else {
        clean += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'double-quote') {
      if (character === '"' && next === '"') {
        clean += '  ';
        index += 1;
      } else if (character === '"') {
        state = 'normal';
        clean += ' ';
      } else {
        clean += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) {
        clean += ' '.repeat(dollarTag.length);
        index += dollarTag.length - 1;
        state = 'normal';
        dollarTag = '';
      } else {
        clean += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (character === '-' && next === '-') {
      state = 'line-comment';
      clean += '  ';
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      state = 'block-comment';
      clean += '  ';
      index += 1;
      continue;
    }
    if (character === "'") {
      state = 'single-quote';
      clean += ' ';
      continue;
    }
    if (character === '"') {
      state = 'double-quote';
      clean += ' ';
      continue;
    }
    if (character === '$') {
      const tagMatch = sql.slice(index).match(/^\$[a-z_][a-z0-9_]*\$|^\$\$/i);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        state = 'dollar-quote';
        clean += ' '.repeat(dollarTag.length);
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (character === ';') semicolonPositions.push(clean.length);
    clean += character;
  }

  if (state !== 'normal' && state !== 'line-comment') {
    throw new Error('query contains an unterminated SQL quote or comment');
  }

  return { clean, semicolonPositions };
}

export function assertReadOnlyQuery(query, label = 'query') {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new Error(`${label} must be a non-empty SQL string`);
  }

  const { clean, semicolonPositions } = scanSql(query);
  const trimmed = clean.trim();
  if (!/^(?:SELECT|WITH)\b/i.test(trimmed)) {
    throw new Error(`${label} must be a single SELECT or WITH statement`);
  }

  if (semicolonPositions.length > 1) {
    throw new Error(`${label} contains multiple SQL statements`);
  }
  if (semicolonPositions.length === 1 && clean.slice(semicolonPositions[0] + 1).trim() !== '') {
    throw new Error(`${label} contains multiple SQL statements`);
  }

  if (FORBIDDEN_KEYWORDS.test(clean)) {
    throw new Error(`${label} contains a forbidden write or administrative SQL keyword`);
  }
  if (/\bSELECT\b[\s\S]*?\bINTO\b/i.test(clean)) {
    throw new Error(`${label} must not use SELECT INTO`);
  }
  if (/\bFOR\s+(?:UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i.test(clean)) {
    throw new Error(`${label} must not acquire row locks`);
  }

  return query;
}

function assertNonEmptyString(value, field, invariantIndex) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`invariant ${invariantIndex} ${field} must be a non-empty string`);
  }
}

export function validateInvariantDeclarations(declarations) {
  if (!Array.isArray(declarations) || declarations.length === 0) {
    throw new Error('data invariant declarations must be a non-empty JSON array');
  }

  const ids = new Set();
  return declarations.map((declaration, index) => {
    if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
      throw new Error(`invariant ${index + 1} must be an object`);
    }

    assertNonEmptyString(declaration.id, 'id', index + 1);
    if (!ID_PATTERN.test(declaration.id)) {
      throw new Error(`invariant ${index + 1} id must match ${ID_PATTERN}`);
    }
    if (ids.has(declaration.id)) {
      throw new Error(`duplicate data invariant id ${declaration.id}`);
    }
    ids.add(declaration.id);

    assertNonEmptyString(declaration.description, 'description', index + 1);
    assertNonEmptyString(declaration.context, 'context', index + 1);
    if (!SEVERITIES.has(declaration.severity)) {
      throw new Error(
        `invariant ${declaration.id} severity must be one of ${[...SEVERITIES].join(', ')}`,
      );
    }
    assertNonEmptyString(declaration.query, 'query', index + 1);
    assertReadOnlyQuery(declaration.query, `invariant ${declaration.id} query`);

    return {
      id: declaration.id,
      description: declaration.description.trim(),
      context: declaration.context.trim(),
      severity: declaration.severity,
      query: declaration.query.trim(),
    };
  });
}

export function loadInvariantDeclarations(declarationsPath = DEFAULT_DECLARATIONS_PATH) {
  let declarations;
  try {
    declarations = JSON.parse(readFileSync(declarationsPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `could not load data invariant declarations from ${declarationsPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return validateInvariantDeclarations(declarations);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function executeReadOnlyQuery(pool, declaration) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query({ text: declaration.query, values: [] });
    await client.query('ROLLBACK');
    return result.rows;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original query error; the connection is released below.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function runInvariantChecks(declarations, { pool, sampleLimit = DEFAULT_SAMPLE_LIMIT } = {}) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('runInvariantChecks requires a pg Pool-like object');
  }
  if (!Number.isInteger(sampleLimit) || sampleLimit < 1) {
    throw new Error('sampleLimit must be a positive integer');
  }

  const outcomes = [];
  for (const declaration of validateInvariantDeclarations(declarations)) {
    try {
      const rows = await executeReadOnlyQuery(pool, declaration);
      outcomes.push({
        id: declaration.id,
        description: declaration.description,
        context: declaration.context,
        severity: declaration.severity,
        status: rows.length === 0 ? 'passed' : 'failed',
        violationCount: rows.length,
        violations: rows.slice(0, sampleLimit),
      });
    } catch (error) {
      outcomes.push({
        id: declaration.id,
        description: declaration.description,
        context: declaration.context,
        severity: declaration.severity,
        status: 'error',
        violationCount: null,
        violations: [],
        error: errorMessage(error),
      });
    }
  }

  return {
    mode: 'live',
    checkedAt: new Date().toISOString(),
    total: outcomes.length,
    passed: outcomes.filter(({ status }) => status === 'passed').length,
    failed: outcomes.filter(({ status }) => status !== 'passed').length,
    invariants: outcomes,
  };
}

export function formatTextReport(report) {
  const lines = [
    `Data invariant check ${report.failed === 0 ? 'passed' : 'failed'} (${report.passed}/${report.total} passed).`,
  ];

  for (const invariant of report.invariants ?? []) {
    const marker = invariant.status === 'passed' ? 'PASS' : invariant.status.toUpperCase();
    const count = invariant.violationCount === null ? 'query error' : `${invariant.violationCount} violation(s)`;
    lines.push(`[${marker}] ${invariant.id} (${invariant.context}, ${invariant.severity}) — ${count}`);
    if (invariant.error) lines.push(`  Error: ${invariant.error}`);
    for (const violation of invariant.violations ?? []) {
      lines.push(`  - ${JSON.stringify(violation)}`);
    }
  }

  return lines.join('\n');
}

function parseArguments(argv) {
  const allowed = new Set(['--dry-run', '--json']);
  const unknown = argv.filter((argument) => !allowed.has(argument));
  if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(', ')}`);
  return { dryRun: argv.includes('--dry-run'), json: argv.includes('--json') };
}

async function main() {
  const { dryRun, json } = parseArguments(process.argv.slice(2));
  const declarations = loadInvariantDeclarations();

  if (dryRun) {
    const report = {
      mode: 'dry-run',
      valid: true,
      total: declarations.length,
      declarations: declarations.map(({ id, context, severity }) => ({ id, context, severity })),
    };
    console.log(json ? JSON.stringify(report, null, 2) : `Data invariant declarations passed dry-run validation (${report.total} invariants).`);
    return;
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is required for live invariant checks');
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: DEFAULT_STATEMENT_TIMEOUT_MS,
    max: 1,
  });
  try {
    const report = await runInvariantChecks(declarations, { pool });
    console.log(json ? JSON.stringify(report, null, 2) : formatTextReport(report));
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href) {
  main().catch((error) => {
    const message = `Data invariant check failed: ${errorMessage(error)}`;
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ mode: process.argv.includes('--dry-run') ? 'dry-run' : 'live', valid: false, error: errorMessage(error) }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  });
}
