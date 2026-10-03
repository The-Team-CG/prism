import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

async function runPrisma(connection, args, migrationPath) {
  const env = environmentFor(connection);
  if (migrationPath) env.PRISMA_MIGRATIONS_PATH = migrationPath;
  const result = await run(process.execPath, [PRISMA_CLI, ...args], { env });
  assertCommandSucceeded(result, 'prisma ' + args.join(' '));
  return result;
}

function copyMigrationSet(destination, predicate, omitQuoteForeignKey = false) {
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
    if (omitQuoteForeignKey && name === POLICY.quoteRequestFkMigration) {
      const sqlPath = path.join(target, 'migration.sql');
      const sql = readFileSync(sqlPath, 'utf8');
      const marker = 'ALTER TABLE "supplier_ops"."quotes"';
      const markerIndex = sql.indexOf(marker);
      if (markerIndex < 0) throw new Error('Quote request FK migration does not contain the expected FK operation.');
      writeFileSync(sqlPath, sql.slice(0, markerIndex), 'utf8');
    }
  }
  cpSync(path.join(MIGRATIONS_ROOT, 'migration_lock.toml'), path.join(destination, 'migration_lock.toml'));
}

function temporaryMigrationPath(tempRoot, name, predicate, omitQuoteForeignKey = false) {
  const destination = path.join(tempRoot, name);
  copyMigrationSet(destination, predicate, omitQuoteForeignKey);
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

async function applyBaselineAndCurrent(connection, tempRoot, tempName) {
  const historicalPath = temporaryMigrationPath(
    tempRoot,
    tempName,
    (name) => name <= POLICY.upgradeBaselineMigration,
  );
  await runPrisma(connection, ['migrate', 'deploy'], historicalPath);
  await runPrisma(connection, ['migrate', 'deploy']);
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
    const { rows } = await adminPool.query('SHOW server_version_num');
    const major = Math.floor(Number(rows[0]?.server_version_num) / 10000);
    if (major !== POLICY.postgresMajor) {
      throw new Error('Expected PostgreSQL ' + POLICY.postgresMajor + ', received major ' + major + '.');
    }

    const names = databaseNames();
    await assertDatabasesAbsent(adminPool, names);
    await createDatabases(adminPool, names);

    const fresh = connectionForDatabase(admin.connectionString, 'prism_ci_fresh');
    await runPrisma(fresh, ['migrate', 'deploy']);
    await verifySchema(fresh.prismaConnectionString);

    const upgraded = connectionForDatabase(admin.connectionString, 'prism_ci_upgraded');
    await applyBaselineAndCurrent(upgraded, tempRoot, 'upgraded-checkpoint');
    await verifySchema(upgraded.prismaConnectionString);

    const p0Template = connectionForDatabase(admin.connectionString, 'prism_ci_p0_template');
    await applyBaselineAndCurrent(p0Template, tempRoot, 'p0-template-checkpoint');
    await verifySchema(p0Template.prismaConnectionString);

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
    }
    assertDatabaseSuiteReport(behaviorReport);

    const missingFk = connectionForDatabase(admin.connectionString, 'prism_ci_missing_fk');
    const missingFkPath = temporaryMigrationPath(
      tempRoot,
      'missing-quote-fk',
      () => true,
      true,
    );
    await runPrisma(missingFk, ['migrate', 'deploy'], missingFkPath);
    await verifyExpectedFailure(missingFk, 'PRISMA_SCHEMA_DRIFT', 'An omitted same-domain quote request FK');

    const unexpected = connectionForDatabase(admin.connectionString, 'prism_ci_unexpected_object');
    await runPrisma(unexpected, ['migrate', 'deploy']);
    await verifyExpectedFailure(
      unexpected,
      'SQL_ONLY_OBJECT_DRIFT',
      'An unapproved SQL-only expression index',
      async () => {
        const pool = new Pool({
          connectionString: unexpected.connectionString,
          ssl: false,
          connectionTimeoutMillis: 5_000,
          max: 1,
        });
        try {
          await pool.query(
            'CREATE INDEX ' + quoteSqlIdentifier('prism_ci_unexpected_expression_idx')
            + ' ON "supplier_ops"."quotes" (lower("request_id"))',
          );
        } finally {
          await pool.end();
        }
      },
    );

    process.stdout.write(
      'PostgreSQL ' + POLICY.postgresMajor
      + ' migration integrity passed: fresh and upgraded schemas match; '
      + behaviorFiles.length + ' isolated DB behavior suites (' + behaviorReport.numPassedTests + ' tests) pass; '
      + 'omitted FK and unexpected SQL object fail as expected.\n',
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
