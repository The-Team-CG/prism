import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { normalizeDatabaseConnection } from './db-connection-config.mjs';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(API_ROOT, 'package.json'));
const prismaCli = require.resolve('prisma/build/index.js');
const inventoryPath = path.join(API_ROOT, 'prisma', 'schema-sql-exceptions.json');
const schemaPath = path.join(API_ROOT, 'prisma', 'schema.prisma');

export class SchemaEquivalenceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SchemaEquivalenceError';
    this.code = code;
  }
}

export function redactText(value) {
  return String(value ?? '').replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, 'postgresql://[REDACTED]');
}

export function assertExactSqlOnlyInventory(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new SchemaEquivalenceError('SQL-only inventory must be an array.', 'SQL_ONLY_OBJECT_DRIFT');
  }

  const keyFor = (item) => [item.kind, item.schema, item.name].join('.');
  const actualByKey = new Map(actual.map((item) => [keyFor(item), item]));
  const expectedByKey = new Map(expected.map((item) => [keyFor(item), item]));
  if (actualByKey.size !== actual.length || expectedByKey.size !== expected.length) {
    throw new SchemaEquivalenceError('SQL-only object inventory contains duplicate identities.', 'SQL_ONLY_OBJECT_DRIFT');
  }
  const unexpected = [...actualByKey.keys()].filter((key) => !expectedByKey.has(key));
  const missing = [...expectedByKey.keys()].filter((key) => !actualByKey.has(key));
  const changed = [];

  for (const [key, item] of expectedByKey) {
    const found = actualByKey.get(key);
    if (found && found.definition !== item.definition) changed.push(key);
    const owners = ['event-lifecycle', 'commercial', 'operations', 'live-ops', 'floorplan', 'identity-access', 'platform-ops'];
    if (!owners.includes(item.ownerDomain) || !item.rationale?.trim() || !item.definition?.trim()) {
      throw new SchemaEquivalenceError(
        'SQL-only exception ' + key + ' must record an approved ownerDomain, exact definition, and rationale.',
        'SQL_ONLY_OBJECT_DRIFT',
      );
    }
  }

  if (unexpected.length || missing.length || changed.length) {
    const details = [
      unexpected.length ? 'unexpected: ' + unexpected.join(', ') : '',
      missing.length ? 'missing: ' + missing.join(', ') : '',
      changed.length ? 'definition changed: ' + changed.join(', ') : '',
    ].filter(Boolean).join('; ');
    throw new SchemaEquivalenceError('SQL-only catalog drift (' + details + ').', 'SQL_ONLY_OBJECT_DRIFT');
  }
}

export function assertPrismaDiffClean(result) {
  if (result.code !== 0) {
    const detail = redactText([result.stdout, result.stderr].filter(Boolean).join('\n')).trim();
    throw new SchemaEquivalenceError(
      'Prisma schema differs from the migrated database.' + (detail ? '\n' + detail : ''),
      'PRISMA_SCHEMA_DRIFT',
    );
  }
}

export function assertCommandSucceeded(result, label) {
  if (result.code !== 0) {
    const detail = redactText([result.stdout, result.stderr].filter(Boolean).join('\n')).trim();
    throw new SchemaEquivalenceError(
      label + ' failed with exit code ' + String(result.code) + '.' + (detail ? '\n' + detail : ''),
      'REQUIRED_DATABASE_CHECK_FAILED',
    );
  }
}

export function assertDatabaseSuiteReport(report) {
  if (
    !report
    || !Number.isInteger(report.numTotalTests)
    || report.numTotalTests < 1
    || report.numFailedTests !== 0
    || report.numPendingTests !== 0
    || report.numPassedTests !== report.numTotalTests
  ) {
    const counts = report
      ? ' passed=' + String(report.numPassedTests)
        + ', failed=' + String(report.numFailedTests)
        + ', skipped/pending=' + String(report.numPendingTests)
        + ', total=' + String(report.numTotalTests)
      : '';
    const skippedNames = (report?.testResults || [])
      .flatMap((suite) => (suite.assertionResults || [])
        .filter((assertion) => assertion.status === 'skipped' || assertion.status === 'pending')
        .map((assertion) => assertion.fullName || assertion.title));
    throw new SchemaEquivalenceError(
      'Required PostgreSQL behavior tests must all run and pass.' + counts
        + (skippedNames.length ? '; skipped: ' + skippedNames.join(', ') : ''),
      'REQUIRED_DATABASE_CHECK_FAILED',
    );
  }
}
function sqlOnlyObjectsQuery() {
  return [
    "SELECT kind, schema_name AS schema, object_name AS name, definition",
    "FROM (",
    "  SELECT CASE WHEN ix.indexprs IS NOT NULL THEN 'expression-index' ELSE 'included-index' END AS kind,",
    "    ns.nspname AS schema_name, idx.relname AS object_name, pg_get_indexdef(idx.oid) AS definition",
    "  FROM pg_index ix JOIN pg_class idx ON idx.oid = ix.indexrelid JOIN pg_namespace ns ON ns.oid = idx.relnamespace",
    "  WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    "    AND (ix.indexprs IS NOT NULL OR ix.indnatts > ix.indnkeyatts)",
    "  UNION ALL",
    "  SELECT CASE cls.relkind WHEN 'v' THEN 'view' ELSE 'materialized-view' END,",
    "    ns.nspname, cls.relname, pg_get_viewdef(cls.oid, true)",
    "  FROM pg_class cls JOIN pg_namespace ns ON ns.oid = cls.relnamespace",
    "  WHERE cls.relkind IN ('v', 'm') AND ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    "  UNION ALL",
    "  SELECT 'trigger', ns.nspname, tbl.relname || '.' || trg.tgname, pg_get_triggerdef(trg.oid, true)",
    "  FROM pg_trigger trg JOIN pg_class tbl ON tbl.oid = trg.tgrelid JOIN pg_namespace ns ON ns.oid = tbl.relnamespace",
    "  WHERE NOT trg.tgisinternal AND ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    "  UNION ALL",
    "  SELECT 'routine', ns.nspname, proc.proname, pg_get_functiondef(proc.oid)",
    "  FROM pg_proc proc JOIN pg_namespace ns ON ns.oid = proc.pronamespace",
    "  WHERE proc.prokind IN ('f', 'p') AND ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    "    AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass",
    "      AND dep.objid = proc.oid AND dep.deptype = 'e')",
    "  UNION ALL",
    "  SELECT CASE typ.typtype WHEN 'd' THEN 'domain' ELSE 'composite-type' END,",
    "    ns.nspname, typ.typname, format_type(typ.oid, NULL)",
    "  FROM pg_type typ JOIN pg_namespace ns ON ns.oid = typ.typnamespace",
    "  WHERE typ.typtype IN ('d', 'c') AND typ.typrelid = 0",
    "    AND ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    "    AND NOT EXISTS (SELECT 1 FROM pg_class cls WHERE cls.reltype = typ.oid)",
    "  UNION ALL",
    "  SELECT 'rule', ns.nspname, tbl.relname || '.' || rule.rulename, pg_get_ruledef(rule.oid, true)",
    "  FROM pg_rewrite rule JOIN pg_class tbl ON tbl.oid = rule.ev_class JOIN pg_namespace ns ON ns.oid = tbl.relnamespace",
    "  WHERE rule.rulename <> '_RETURN' AND ns.nspname NOT IN ('pg_catalog', 'information_schema')",
    ") sql_only ORDER BY schema, kind, name",
  ].join('\n');
}
export async function collectSqlOnlyInventory(pool) {
  const { rows } = await pool.query(sqlOnlyObjectsQuery());
  return rows;
}

function loadExceptionManifest() {
  let parsed;
  try {
    parsed = JSON.parse(require('node:fs').readFileSync(inventoryPath, 'utf8'));
  } catch {
    throw new SchemaEquivalenceError('Could not read the SQL-only exception manifest.', 'SQL_ONLY_OBJECT_DRIFT');
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.sqlOnlyObjects)) {
    throw new SchemaEquivalenceError('SQL-only exception manifest has an unsupported shape.', 'SQL_ONLY_OBJECT_DRIFT');
  }
  return parsed.sqlOnlyObjects;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = require('node:child_process').spawn(command, args, {
      cwd: options.cwd || API_ROOT,
      env: options.env || process.env,
      windowsHide: true,
      shell: false,
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

export async function verifySchema(connectionUrl = process.env.PRISMA_DATABASE_URL) {
  if (!connectionUrl) throw new SchemaEquivalenceError('Set PRISMA_DATABASE_URL for schema verification.', 'REQUIRED_DATABASE_CHECK_FAILED');
  let connection;
  try {
    connection = normalizeDatabaseConnection(connectionUrl, {
      purpose: 'migration',
      env: { ...process.env, PRISMA_DATABASE_URL: connectionUrl },
      cwd: API_ROOT,
    });
  } catch (error) {
    throw new SchemaEquivalenceError(error.message, 'REQUIRED_DATABASE_CHECK_FAILED');
  }

  const pool = new Pool({
    connectionString: connection.connectionString,
    ssl: connection.ssl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  try {
    await pool.query('SELECT 1');
    const expected = loadExceptionManifest();
    const actual = await collectSqlOnlyInventory(pool);
    assertExactSqlOnlyInventory(actual, expected);

    const prismaEnvironment = {
      ...process.env,
      PRISMA_DATABASE_URL: connection.prismaConnectionString,
      DIRECT_URL: connection.prismaConnectionString,
      DATABASE_URL: connection.prismaConnectionString,
      SUPABASE_DB_URL: connection.prismaConnectionString,
      DB_SSL: connection.ssl ? 'true' : 'false',
      JITI_CACHE: 'false',
    };
    delete prismaEnvironment.PRISMA_MIGRATIONS_PATH;
    const diff = await runProcess(process.execPath, [
      prismaCli,
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      schemaPath,
      '--exit-code',
    ], { env: prismaEnvironment });
    assertPrismaDiffClean(diff);
    return { sqlOnlyObjects: actual.length, prismaDiffExitCode: diff.code };
  } catch (error) {
    if (error instanceof SchemaEquivalenceError) throw error;
    throw new SchemaEquivalenceError(
      'Database schema verification could not complete: ' + redactText(error.message),
      'REQUIRED_DATABASE_CHECK_FAILED',
    );
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifySchema()
    .then((result) => {
      process.stdout.write('Database schema matches Prisma; exact SQL-only object count: ' + result.sqlOnlyObjects + '.\n');
    })
    .catch((error) => {
      process.stderr.write('[' + (error.code || 'DATABASE_SCHEMA_VERIFY_FAILED') + '] ' + error.message + '\n');
      process.exitCode = 1;
    });
}