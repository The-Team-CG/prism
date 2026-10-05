import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SchemaEquivalenceError,
  assertCommandSucceeded,
  assertDatabaseSuiteReport,
  assertExactSqlOnlyInventory,
  collectSqlOnlyInventory,
  assertPrismaDiffClean,
  redactText,
} from './db-schema-equivalence.mjs';

test('empty SQL-only inventory is an exact clean match', () => {
  assert.doesNotThrow(() => assertExactSqlOnlyInventory([], []));
});

test('a missing same-domain foreign key is rejected as Prisma schema drift', () => {
  assert.throws(
    () => assertPrismaDiffClean({
      code: 2,
      stdout: '[-] Foreign key quotes_request_id_fkey',
      stderr: '',
    }),
    (error) => error instanceof SchemaEquivalenceError && error.code === 'PRISMA_SCHEMA_DRIFT',
  );
});

test('SQL-only objects require exact identity and definition plus an owner and rationale', () => {
  const expected = [{
    kind: 'expression-index',
    schema: 'commercial',
    name: 'quotes_lower_name_idx',
    definition: 'CREATE INDEX quotes_lower_name_idx ON commercial.quotes USING btree (lower(name))',
    ownerDomain: 'commercial',
    rationale: 'Temporary compatibility object pending Prisma support.',
  }];
  assert.doesNotThrow(() => assertExactSqlOnlyInventory(expected, expected));

  for (const actual of [
    [],
    [{ ...expected[0], definition: 'CREATE INDEX changed_definition' }],
    [...expected, { ...expected[0], name: 'unapproved_idx' }],
  ]) {
    assert.throws(
      () => assertExactSqlOnlyInventory(actual, expected),
      (error) => error instanceof SchemaEquivalenceError && error.code === 'SQL_ONLY_OBJECT_DRIFT',
    );
  }

  assert.throws(
    () => assertExactSqlOnlyInventory([{ ...expected[0], ownerDomain: undefined }], [{ ...expected[0], ownerDomain: undefined }]),
    /approved ownerDomain, exact definition, and rationale/,
  );
});

test('a failed PostgreSQL behavior suite fails the required gate', () => {
  assert.throws(
    () => assertCommandSucceeded({ code: 1, stdout: '1 failed, 3 skipped', stderr: '' }, 'PostgreSQL behavior acceptance suite'),
    (error) => error instanceof SchemaEquivalenceError && error.code === 'REQUIRED_DATABASE_CHECK_FAILED',
  );
});

test('diagnostics redact PostgreSQL credentials', () => {
  const message = redactText('failed at postgresql://user:super-secret@127.0.0.1:55437/prism_p0');
  assert.doesNotMatch(message, /super-secret/);
  assert.match(message, /postgresql:\/\/\[REDACTED\]/);
});
test('required PostgreSQL acceptance cannot pass with skipped tests', () => {
  assert.throws(
    () => assertDatabaseSuiteReport({
      numTotalTests: 4,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 4,
    }),
    (error) => error instanceof SchemaEquivalenceError && error.code === 'REQUIRED_DATABASE_CHECK_FAILED',
  );
  assert.doesNotThrow(() => assertDatabaseSuiteReport({
    numTotalTests: 4,
    numPassedTests: 4,
    numFailedTests: 0,
    numPendingTests: 0,
  }));
});
test('catalog inspection receives SQL with actual newlines', async () => {
  let statement;
  const rows = [];
  await collectSqlOnlyInventory({
    query: async (sql) => {
      statement = sql;
      return { rows };
    },
  });
  assert.match(statement, /^SELECT kind, schema_name AS schema, object_name AS name, definition\nFROM \(/);
  assert.doesNotMatch(statement, /\\n/);
});