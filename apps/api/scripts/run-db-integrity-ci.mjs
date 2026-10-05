import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { normalizeDatabaseConnection } from './db-connection-config.mjs';
import { databaseBehaviorTestFiles } from './run-db-behavior-tests.mjs';
import {
  SchemaEquivalenceError,
  assertCommandSucceeded,
  assertDatabaseSuiteReport,
  verifySchema,
} from './db-schema-equivalence.mjs';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_ROOT = path.join(API_ROOT, 'prisma', 'migrations');
const POLICY_PATH = path.join(API_ROOT, 'prisma', 'migration-replay-policy.json');
const POLICY = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
const require = createRequire(path.join(API_ROOT, 'package.json'));
const PRISMA_CLI = require.resolve('prisma/build/index.js');

function databaseNames() {
  return [
    'prism_ci_fresh',
    'prism_ci_upgraded',
    'prism_ci_p0_template',
    'prism_p0',
    'prism_ci_missing_fk',
    'prism_ci_unexpected_object',
  ];
}

function safeConnection(rawUrl, expectedDatabase) {
  let normalized;
  try {
    normalized = normalizeDatabaseConnection(rawUrl, {
      purpose: 'migration',
      env: { ...process.env, DB_SSL: 'false' },
      cwd: API_ROOT,
    });
  } catch (error) {
    throw new Error('DB_INTEGRITY_ADMIN_URL is invalid: ' + error.message);
  }

  const parsed = new URL(normalized.connectionString);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (
    normalized.hostname !== '127.0.0.1'
    || normalized.port !== '55437'
    || database !== expectedDatabase
  ) {
    throw new Error('Disposable database URL must resolve to 127.0.0.1:55437/' + expectedDatabase + '.');
  }
  return normalized;
}

function connectionForDatabase(adminUrl, database) {
  const parsed = new URL(adminUrl);
  parsed.pathname = '/' + database;
  parsed.searchParams.delete('host');
  parsed.searchParams.delete('port');
  const normalized = normalizeDatabaseConnection(parsed.href, {
    purpose: 'migration',
    env: { ...process.env, DB_SSL: 'false' },
    cwd: API_ROOT,
  });
  assert.equal(normalized.hostname, '127.0.0.1');
  assert.equal(normalized.port, '55437');
  return normalized;
}

function environmentFor(connection, extra = {}) {
  const url = connection.prismaConnectionString;
  return {
    ...process.env,
    PRISMA_DATABASE_URL: url,
    DIRECT_URL: url,
    DATABASE_URL: url,
    SUPABASE_DB_URL: url,
    DB_SSL: 'false',
    JITI_CACHE: 'false',
    PRISMA_MIGRATIONS_PATH: '',
    ...extra,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || API_ROOT,
      env: options.env || process.env,
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function runTimedStep(label, action) {
  const startedAt = performance.now();
  process.stdout.write('[db:integrity] ' + label + ' started.\n');
  try {
    const result = await action();
    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write('[db:integrity] ' + label + ' completed in ' + elapsedSeconds + 's.\n');
    return result;
  } catch (error) {
    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    process.stderr.write('[db:integrity] ' + label + ' failed after ' + elapsedSeconds + 's.\n');
    throw error;
  }
}

async function runDatabaseProbe(connection, sql) {
  const pool = new Pool({
    connectionString: connection.connectionString,
    ssl: false,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

async function runPrisma(connection, args, migrationPath) {
  const env = environmentFor(connection);
  if (migrationPath) env.PRISMA_MIGRATIONS_PATH = migrationPath;
  const result = await run(process.execPath, [PRISMA_CLI, ...args], { env });
  assertCommandSucceeded(result, 'prisma ' + args.join(' '));
  return result;
}

function copyMigrationSet(destination, predicate) {
  const names = readdirSync(MIGRATIONS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (!names.includes(POLICY.upgradeBaselineMigration)) {
    throw new Error('Configured upgrade baseline migration does not exist.');
  }
  for (const name of names) {
    const source = path.join(MIGRATIONS_ROOT, name);
    const target = path.join(destination, name);
    cpSync(source, target, { recursive: true });
  }
  cpSync(path.join(MIGRATIONS_ROOT, 'migration_lock.toml'), path.join(destination, 'migration_lock.toml'));
}

function temporaryMigrationPath(tempRoot, name, predicate) {
  const destination = path.join(tempRoot, name);
  copyMigrationSet(destination, predicate);
  return destination;
}

async function assertDatabasesAbsent(adminPool, names) {
  const { rows } = await adminPool.query(
    'SELECT datname FROM pg_database WHERE datname = ANY($1::text[])',
    [names],
  );
  if (rows.length) {
    throw new Error('Refusing to reuse existing disposable database(s): ' + rows.map((row) => row.datname).join(', ') + '.');
  }
}

async function createDatabases(adminPool, names) {
  for (const name of names) {
    await adminPool.query('CREATE DATABASE "' + name + '"');
  }
}

function quoteSqlIdentifier(value) {
  return '"' + value.replaceAll('"', '""') + '"';
}

async function resetBehaviorDatabase(adminPool, template, target) {
  const targetIdentifier = quoteSqlIdentifier(target);
  await adminPool.query('DROP DATABASE IF EXISTS ' + targetIdentifier + ' WITH (FORCE)');
  await adminPool.query(
    'CREATE DATABASE ' + targetIdentifier + ' WITH TEMPLATE ' + quoteSqlIdentifier(template),
  );
}

async function seedUpgradeCheckpoint(connection) {
  const suffix = randomUUID().replaceAll('-', '');
  const fixture = {
    inquiryId: 'prism_ci_upgrade_inquiry_' + suffix,
    eventId: 'prism_ci_upgrade_event_' + suffix,
    categoryId: 'prism_ci_upgrade_category_' + suffix,
    supplierId: 'prism_ci_upgrade_supplier_' + suffix,
    requestId: 'prism_ci_upgrade_request_' + suffix,
    quoteId: 'prism_ci_upgrade_quote_' + suffix,
  };
  const pool = new Pool({
    connectionString: connection.connectionString,
    ssl: false,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO event_core.inquiries (id, client_name, email, event_name, event_date, client_type, normalized_email) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fixture.inquiryId, 'Upgrade checkpoint client', suffix + '@upgrade.test', 'Upgrade checkpoint event', '2032-06-18', 'corporate', suffix + '@upgrade.test'],
    );
    await client.query(
      'INSERT INTO event_core.events (id, inquiry_id, client_name, event_name, event_date) VALUES ($1, $2, $3, $4, $5)',
      [fixture.eventId, fixture.inquiryId, 'Upgrade checkpoint client', 'Upgrade checkpoint event', '2032-06-18'],
    );
    await client.query(
      'INSERT INTO supplier_ops.supplier_categories (id, slug, name) VALUES ($1, $2, $3)',
      [fixture.categoryId, fixture.categoryId + '-slug', 'Upgrade checkpoint category'],
    );
    await client.query(
      'INSERT INTO supplier_ops.suppliers (id, category_id, name, email) VALUES ($1, $2, $3, $4)',
      [fixture.supplierId, fixture.categoryId, 'Upgrade checkpoint supplier', suffix + '@supplier.test'],
    );
    await client.query(
      'INSERT INTO supplier_ops.quote_requests (id, event_id, supplier_id, category_id, supplier_name, category, access_token) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fixture.requestId, fixture.eventId, fixture.supplierId, fixture.categoryId, 'Upgrade checkpoint supplier', 'Upgrade checkpoint category', fixture.requestId + '-token'],
    );
    await client.query(
      'INSERT INTO supplier_ops.quotes (id, event_id, request_id, supplier_id, category_id, supplier_name, category, amount) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [fixture.quoteId, fixture.eventId, fixture.requestId, fixture.supplierId, fixture.categoryId, 'Upgrade checkpoint supplier', 'Upgrade checkpoint category', 12500],
    );
    await client.query('COMMIT');
    return fixture;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function assertUpgradeFixturePreserved(connection, fixture) {
  const pool = new Pool({
    connectionString: connection.connectionString,
    ssl: false,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  try {
    const { rows } = await pool.query(
      'SELECT quote.id, quote.request_id, quote.amount, request.id AS found_request_id '
      + 'FROM commercial.quotes AS quote '
      + 'JOIN commercial.quote_requests AS request ON request.id = quote.request_id '
      + 'WHERE quote.id = $1 AND quote.event_id = $2',
      [fixture.quoteId, fixture.eventId],
    );
    assert.equal(rows.length, 1, 'Checkpoint quote/request evidence must survive the remaining migrations.');
    assert.equal(rows[0].request_id, fixture.requestId);
    assert.equal(rows[0].found_request_id, fixture.requestId);
    assert.equal(rows[0].amount, 12500);

    const constraints = await pool.query(
      'SELECT convalidated, confdeltype FROM pg_constraint '
      + 'WHERE conrelid = to_regclass($1) AND conname = $2 AND contype = \'f\'',
      ['commercial.quotes', 'quotes_request_id_fkey'],
    );
    assert.equal(constraints.rows.length, 1, 'The upgraded same-domain quote/request FK must exist.');
    assert.equal(constraints.rows[0].convalidated, true);
    assert.equal(constraints.rows[0].confdeltype, 'r', 'The upgraded FK must restrict deletion of referenced quote requests.');
  } finally {
    await pool.end();
  }
}

async function applyBaselineAndCurrent(connection, tempRoot, tempName, afterBaseline) {
  const historicalPath = temporaryMigrationPath(
    tempRoot,
    tempName,
    (name) => name <= POLICY.upgradeBaselineMigration,
  );
  await runPrisma(connection, ['migrate', 'deploy'], historicalPath);
  const checkpointResult = afterBaseline ? await afterBaseline() : undefined;
  await runPrisma(connection, ['migrate', 'deploy']);
  return checkpointResult;
}

async function verifyExpectedFailure(connection, expectedCode, label, beforeCheck) {
  if (beforeCheck) await beforeCheck();
  try {
    await verifySchema(connection.prismaConnectionString);
  } catch (error) {
    if (error instanceof SchemaEquivalenceError && error.code === expectedCode) return;
    throw error;
  }
  throw new Error(label + ' was not detected by the schema-equivalence gate.');
}

function removeTemporaryRoot(tempRoot) {
  const resolvedTemp = path.resolve(os.tmpdir());
  const resolvedTarget = path.resolve(tempRoot);
  const relative = path.relative(resolvedTemp, resolvedTarget);
  if (
    !relative
    || relative.startsWith('..' + path.sep)
    || path.isAbsolute(relative)
    || !path.basename(resolvedTarget).startsWith('prism-db-integrity-')
  ) {
    throw new Error('Refusing to remove an unexpected temporary migration directory.');
  }
  rmSync(resolvedTarget, { recursive: true, force: true });
}

async function main() {
  const totalStartedAt = performance.now();
  const adminUrl = process.env.DB_INTEGRITY_ADMIN_URL?.trim();
  if (!adminUrl) throw new Error('Set DB_INTEGRITY_ADMIN_URL for the disposable PostgreSQL integrity job.');
  const admin = safeConnection(adminUrl, 'postgres');
  if (process.env.DB_SSL?.trim().toLowerCase() !== 'false') {
    throw new Error('DB_SSL=false is required only for the loopback PostgreSQL CI service.');
  }

  const adminPool = new Pool({
    connectionString: admin.connectionString,
    ssl: false,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'prism-db-integrity-'));
  try {
    const names = databaseNames();
    await runTimedStep('PostgreSQL version check and disposable database setup', async () => {
      const { rows } = await adminPool.query('SHOW server_version_num');
      const major = Math.floor(Number(rows[0]?.server_version_num) / 10000);
      if (major !== POLICY.postgresMajor) {
        throw new Error('Expected PostgreSQL ' + POLICY.postgresMajor + ', received major ' + major + '.');
      }

      await assertDatabasesAbsent(adminPool, names);
      await createDatabases(adminPool, names);
    });

    const fresh = connectionForDatabase(admin.connectionString, 'prism_ci_fresh');
    await runTimedStep('fresh migration replay and schema verification', async () => {
      await runPrisma(fresh, ['migrate', 'deploy']);
      await verifySchema(fresh.prismaConnectionString);
    });

    const upgraded = connectionForDatabase(admin.connectionString, 'prism_ci_upgraded');
    await runTimedStep('populated checkpoint upgrade and schema verification', async () => {
      const upgradeFixture = await applyBaselineAndCurrent(
        upgraded,
        tempRoot,
        'upgraded-checkpoint',
        () => seedUpgradeCheckpoint(upgraded),
      );
      await verifySchema(upgraded.prismaConnectionString);
      await assertUpgradeFixturePreserved(upgraded, upgradeFixture);
    });

    const p0Template = connectionForDatabase(admin.connectionString, 'prism_ci_p0_template');
    await runTimedStep('behavior template migration replay and schema verification', async () => {
      await applyBaselineAndCurrent(p0Template, tempRoot, 'p0-template-checkpoint');
      await verifySchema(p0Template.prismaConnectionString);
    });

    const behaviorFiles = databaseBehaviorTestFiles();
    if (behaviorFiles.length === 0) throw new Error('No database behavior suites were found.');
    const behaviorReport = {
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [],
    };
    const behaviorDatabaseName = 'prism_p0';
    const behavior = connectionForDatabase(admin.connectionString, behaviorDatabaseName);
    const behaviorRunner = path.join(API_ROOT, 'scripts', 'run-db-behavior-tests.mjs');

    for (const [index, testFile] of behaviorFiles.entries()) {
      await runTimedStep(
        'isolated behavior suite ' + String(index + 1) + '/' + behaviorFiles.length + ': ' + path.basename(testFile),
        async () => {
          await resetBehaviorDatabase(adminPool, 'prism_ci_p0_template', behaviorDatabaseName);
          const reportPath = path.join(
            tempRoot,
            'postgres-test-report-' + String(index + 1).padStart(2, '0') + '.json',
          );
          const integration = await run(
            process.execPath,
            [
              behaviorRunner,
              testFile,
              '--reporter=json',
              '--outputFile=' + reportPath,
            ],
            { env: environmentFor(behavior, { P0_TEST_DATABASE_URL: behavior.prismaConnectionString }) },
          );

          let report;
          try {
            report = JSON.parse(readFileSync(reportPath, 'utf8'));
          } catch {
            assertCommandSucceeded(integration, 'PostgreSQL behavior suite ' + testFile);
            throw new Error('PostgreSQL behavior suite ' + testFile + ' did not produce its JSON report.');
          }

          const assertionDetails = (report.testResults || [])
            .flatMap((suite) => (suite.assertionResults || [])
              .filter((assertion) => assertion.status !== 'passed')
              .map((assertion) => {
                const title = assertion.fullName || assertion.title;
                const failures = (assertion.failureMessages || []).join('\n');
                return failures ? title + ': ' + failures : title;
              }));
          const commandResult = {
            ...integration,
            stdout: integration.stdout + (assertionDetails.length ? '\nDatabase assertions:\n' + assertionDetails.join('\n') : ''),
          };
          assertCommandSucceeded(commandResult, 'PostgreSQL behavior suite ' + testFile);
          assert.equal(
            report.testResults?.length,
            1,
            'Expected exactly one PostgreSQL behavior file to run for ' + testFile + '.',
          );

          behaviorReport.numTotalTests += report.numTotalTests || 0;
          behaviorReport.numPassedTests += report.numPassedTests || 0;
          behaviorReport.numFailedTests += report.numFailedTests || 0;
          behaviorReport.numPendingTests += report.numPendingTests || 0;
          behaviorReport.testResults.push(...report.testResults);
        },
      );
    }
    assertDatabaseSuiteReport(behaviorReport);

    const missingFk = connectionForDatabase(admin.connectionString, 'prism_ci_missing_fk');
    await runTimedStep('missing-FK drift probe on verified schema clone', async () => {
      await resetBehaviorDatabase(adminPool, 'prism_ci_p0_template', 'prism_ci_missing_fk');
      await verifyExpectedFailure(
        missingFk,
        'PRISMA_SCHEMA_DRIFT',
        'An omitted same-domain quote request FK',
        () => runDatabaseProbe(
          missingFk,
          'ALTER TABLE "commercial"."quotes" DROP CONSTRAINT "quotes_request_id_fkey"',
        ),
      );
    });

    const unexpected = connectionForDatabase(admin.connectionString, 'prism_ci_unexpected_object');
    await runTimedStep('unexpected-SQL-object drift probe on verified schema clone', async () => {
      await resetBehaviorDatabase(adminPool, 'prism_ci_p0_template', 'prism_ci_unexpected_object');
      await verifyExpectedFailure(
        unexpected,
        'SQL_ONLY_OBJECT_DRIFT',
        'An unapproved SQL-only expression index',
        () => runDatabaseProbe(
          unexpected,
          'CREATE INDEX ' + quoteSqlIdentifier('prism_ci_unexpected_expression_idx')
          + ' ON "commercial"."quotes" (lower("request_id"))',
        ),
      );
    });

    const elapsedSeconds = ((performance.now() - totalStartedAt) / 1000).toFixed(1);
    process.stdout.write(
      'PostgreSQL ' + POLICY.postgresMajor
      + ' migration integrity passed: fresh replay and populated checkpoint upgrade match; '
      + behaviorFiles.length + ' isolated DB behavior suites (' + behaviorReport.numPassedTests + ' tests) pass; '
      + 'omitted FK and unexpected SQL object fail as expected in ' + elapsedSeconds + 's total.\n',
    );
  } finally {
    try {
      await adminPool.end();
    } finally {
      removeTemporaryRoot(tempRoot);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write('Database integrity CI failed: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
