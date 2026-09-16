import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  assertReadOnlyQuery,
  formatTextReport,
  loadInvariantDeclarations,
  runInvariantChecks,
  validateInvariantDeclarations,
} from './check-data-invariants.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./check-data-invariants.mjs', import.meta.url));

describe('data invariant declaration validation', () => {
  it('loads and validates the checked-in invariant declarations', () => {
    const declarations = loadInvariantDeclarations();
    assert.equal(declarations.length, 6);
    assert.deepEqual(
      declarations.map(({ id }) => id),
      [
        'audit_chain_single_root',
        'audit_chain_no_unhashed_rows',
        'audit_chain_no_orphans',
        'audit_chain_no_forks',
        'billing_sequence_covers_existing_statements',
        'migration_ledger_no_unfinished',
      ],
    );
  });

  it('rejects duplicate ids and malformed declarations', () => {
    assert.throws(
      () => validateInvariantDeclarations([
        { id: 'duplicate', description: 'one', context: 'x', severity: 'high', query: 'SELECT 1' },
        { id: 'duplicate', description: 'two', context: 'x', severity: 'high', query: 'SELECT 1' },
      ]),
      /duplicate data invariant id duplicate/,
    );
    assert.throws(
      () => validateInvariantDeclarations([
        { id: 'not-valid', description: 'one', context: 'x', severity: 'high', query: 'SELECT 1' },
      ]),
      /id must match/,
    );
  });
});

describe('read-only SQL guard', () => {
  it('accepts SELECT, WITH, comments, literals, and one trailing semicolon', () => {
    assert.doesNotThrow(() => assertReadOnlyQuery(`
      -- INSERT INTO should be ignored
      WITH rows AS (SELECT 'UPDATE; DROP TABLE never' AS note)
      SELECT note FROM rows;
    `));
  });

  for (const keyword of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ALTER', 'DROP', 'CREATE', 'GRANT', 'COPY']) {
    it(`rejects ${keyword} statements`, () => {
      assert.throws(
        () => assertReadOnlyQuery(`SELECT 1 ${keyword} something`),
        /forbidden write or administrative SQL keyword/,
      );
    });
  }

  it('rejects write keywords hidden inside a WITH statement', () => {
    assert.throws(
      () => assertReadOnlyQuery('WITH changed AS (UPDATE trust_ops.audit_logs SET actor = actor RETURNING id) SELECT * FROM changed'),
      /forbidden write or administrative SQL keyword/,
    );
  });

  it('rejects multiple statements, including a second statement after a comment', () => {
    assert.throws(() => assertReadOnlyQuery('SELECT 1; SELECT 2'), /multiple SQL statements/);
    assert.throws(() => assertReadOnlyQuery('SELECT 1; -- trailing comment\n SELECT 2'), /multiple SQL statements/);
  });

  it('rejects non-read-only SELECT forms that write or lock', () => {
    assert.throws(() => assertReadOnlyQuery('SELECT * INTO copied_rows FROM source_rows'), /SELECT INTO/);
    assert.throws(() => assertReadOnlyQuery('SELECT * FROM source_rows FOR UPDATE'), /forbidden write or administrative SQL keyword|row locks/);
    assert.throws(() => assertReadOnlyQuery('EXPLAIN SELECT 1'), /single SELECT or WITH/);
  });
});

describe('invariant execution and reporting', () => {
  it('runs each query in a read-only transaction and caps violation samples', async () => {
    const queries = [];
    const pool = {
      async connect() {
        return {
          async query(statement) {
            queries.push(statement);
            if (typeof statement === 'object') {
              return { rows: Array.from({ length: 12 }, (_, index) => ({ id: index + 1 })) };
            }
            return { rows: [] };
          },
          release() {},
        };
      },
    };
    const declarations = [{
      id: 'sample_invariant',
      description: 'sample',
      context: 'platform-ops',
      severity: 'high',
      query: 'SELECT id FROM example_table',
    }];

    const report = await runInvariantChecks(declarations, { pool, sampleLimit: 10 });
    assert.equal(report.failed, 1);
    assert.equal(report.invariants[0].violationCount, 12);
    assert.equal(report.invariants[0].violations.length, 10);
    assert.equal(queries[0], 'BEGIN TRANSACTION READ ONLY');
    assert.deepEqual(queries[1], { text: 'SELECT id FROM example_table', values: [] });
    assert.equal(queries[2], 'ROLLBACK');
    assert.match(formatTextReport(report), /sample_invariant/);
  });
});

describe('dry-run process behavior', () => {
  it('validates declarations without requiring database credentials', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, '--dry-run'], {
      cwd: resolve(SCRIPT_PATH, '..', '..'),
      env: { ...process.env, DIRECT_URL: 'postgresql://invalid-host.invalid/no_connection', DATABASE_URL: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /6 invariants/);
  });
});
