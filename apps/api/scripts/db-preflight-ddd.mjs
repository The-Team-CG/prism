import { createHash } from 'node:crypto';
import { link, open, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';

import { normalizeDatabaseConnection } from './db-connection-config.mjs';
import { assertReadOnlyQuery } from './check-data-invariants.mjs';
import { discoverMigrations } from './check-prisma-migrations.mjs';
import { domainPersistenceCatalog, loadOwnershipManifest, renderOwnerTableReferences } from './domain-persistence-catalog.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const API_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const PREFLIGHT_URL_ENV = 'PRISM_DDD_PREFLIGHT_DATABASE_URL';
const SAMPLE_LIMIT = 10;
const SAFE_DATABASE_NAME = /^(?:prism_p0|prism_(?:preflight|upgrade|restore)_[a-z0-9][a-z0-9_-]{0,50})$/i;
const ACTION_CODES = Object.freeze({ a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' });

const PRECHECK_DECLARATIONS = [
  {
    id: 'duplicate_account_emails',
    owner: 'identity-access',
    description: 'Account emails that collide after trim and case normalization.',
    blocking: true,
    tables: [['identity-access', 'users']],
    query: `WITH duplicates AS (
  SELECT lower(btrim(email)) AS normalized
  FROM {{identity-access.users}}
  WHERE btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
)
SELECT account.id::text AS opaque_id
FROM {{identity-access.users}} AS account
JOIN duplicates ON lower(btrim(account.email)) = duplicates.normalized
ORDER BY account.id`,
  },
  {
    id: 'duplicate_active_floorplan_drafts',
    owner: 'floorplan',
    description: 'Events with more than one active floorplan draft.',
    blocking: true,
    tables: [['floorplan', 'floor_plan_drafts']],
    query: `WITH duplicates AS (
  SELECT event_id
  FROM {{floorplan.floor_plan_drafts}}
  WHERE is_active
  GROUP BY event_id
  HAVING count(*) > 1
)
SELECT draft.id::text AS opaque_id
FROM {{floorplan.floor_plan_drafts}} AS draft
JOIN duplicates USING (event_id)
WHERE draft.is_active
ORDER BY draft.id`,
  },
  {
    id: 'invalid_financial_amounts',
    owner: 'commercial',
    description: 'Negative amounts, non-positive received payments, or invalid cost estimate quantities.',
    blocking: true,
    tables: [
      ['commercial', 'billing_sources'],
      ['commercial', 'billing_statements'],
      ['commercial', 'payment_records'],
      ['commercial', 'payment_milestones'],
      ['commercial', 'cost_estimate_lines'],
      ['commercial', 'cost_estimates'],
    ],
    query: `SELECT id::text AS opaque_id FROM {{commercial.billing_sources}} WHERE total_amount < 0
UNION ALL
SELECT id::text FROM {{commercial.billing_statements}} WHERE total_amount < 0
UNION ALL
SELECT id::text FROM {{commercial.payment_records}} WHERE amount_received <= 0
UNION ALL
SELECT id::text FROM {{commercial.payment_milestones}} WHERE amount < 0 OR amount_paid < 0
UNION ALL
SELECT id::text FROM {{commercial.cost_estimate_lines}}
WHERE quantity <= 0 OR unit_amount < 0 OR total_amount < 0
UNION ALL
SELECT id::text FROM {{commercial.cost_estimates}} WHERE budget_amount < 0 OR total_amount < 0`,
  },
  {
    id: 'invalid_review_ratings',
    owner: 'commercial / operations',
    description: 'Supplier and guest feedback ratings outside the supported 1 through 5 range.',
    blocking: true,
    tables: [
      ['commercial', 'supplier_reviews'],
      ['commercial', 'supplier_review_dimension_ratings'],
      ['operations', 'feedback'],
    ],
    query: `SELECT id::text AS opaque_id FROM {{commercial.supplier_reviews}} WHERE rating < 1 OR rating > 5
UNION ALL
SELECT id::text FROM {{commercial.supplier_review_dimension_ratings}} WHERE rating < 1 OR rating > 5
UNION ALL
SELECT id::text FROM {{operations.feedback}} WHERE rating < 1 OR rating > 5`,
  },
  {
    id: 'invalid_registration_ranges',
    owner: 'operations',
    description: 'Registration headcount ranges are negative or have a minimum above the maximum.',
    blocking: true,
    tables: [['operations', 'registration_platforms']],
    query: `SELECT id::text AS opaque_id
FROM {{operations.registration_platforms}}
WHERE expected_pax_min < 0 OR expected_pax_max < 0 OR expected_pax_min > expected_pax_max OR imported_headcount < 0`,
  },
  {
    id: 'invalid_billing_json_shapes',
    owner: 'commercial',
    description: 'Billing line items, payment schedules, and payment methods must be JSON arrays.',
    blocking: true,
    tables: [['commercial', 'billing_sources'], ['commercial', 'billing_statements']],
    query: `SELECT id::text AS opaque_id
FROM {{commercial.billing_sources}}
WHERE jsonb_typeof(line_items::jsonb) IS DISTINCT FROM 'array'
   OR jsonb_typeof(payment_schedule::jsonb) IS DISTINCT FROM 'array'
   OR jsonb_typeof(payment_methods::jsonb) IS DISTINCT FROM 'array'
UNION ALL
SELECT id::text
FROM {{commercial.billing_statements}}
WHERE jsonb_typeof(line_items::jsonb) IS DISTINCT FROM 'array'
   OR jsonb_typeof(payment_schedule::jsonb) IS DISTINCT FROM 'array'
   OR jsonb_typeof(payment_methods::jsonb) IS DISTINCT FROM 'array'`,
  },
  {
    id: 'invalid_historical_snapshot_shapes',
    owner: 'floorplan / event-lifecycle',
    description: 'Published plans and issued addendum snapshots must be JSON objects.',
    blocking: true,
    tables: [
      ['floorplan', 'published_snapshots'],
      ['event-lifecycle', 'addenda'],
      ['floorplan', 'floor_plan_drafts'],
    ],
    query: `SELECT id::text AS opaque_id FROM {{floorplan.published_snapshots}}
WHERE jsonb_typeof(floor_plan::jsonb) IS DISTINCT FROM 'object'
UNION ALL
SELECT id::text FROM {{event-lifecycle.addenda}}
WHERE jsonb_typeof(contract_snapshot::jsonb) IS DISTINCT FROM 'object'
   OR jsonb_typeof(quote_snapshot::jsonb) IS DISTINCT FROM 'object'
UNION ALL
SELECT id::text FROM {{floorplan.floor_plan_drafts}}
WHERE (client_preference IS NOT NULL AND jsonb_typeof(client_preference::jsonb) IS DISTINCT FROM 'object')
   OR (submitted_snapshot IS NOT NULL AND jsonb_typeof(submitted_snapshot::jsonb) IS DISTINCT FROM 'object')
   OR (approved_snapshot IS NOT NULL AND jsonb_typeof(approved_snapshot::jsonb) IS DISTINCT FROM 'object')`,
  },
  {
    id: 'billing_statement_sequence_state',
    owner: 'commercial',
    description: 'Issued statement numbers parse and their yearly sequence remains ahead of issued numbers.',
    blocking: true,
    tables: [['commercial', 'billing_statements'], ['commercial', 'billing_statement_sequences']],
    query: `WITH parsed AS (
  SELECT id, number,
    CASE WHEN number ~ '^BS-[0-9]{4}-[0-9]+$' THEN split_part(number, '-', 2)::numeric END AS year,
    CASE WHEN number ~ '^BS-[0-9]{4}-[0-9]+$' THEN split_part(number, '-', 3)::numeric END AS sequence_number
  FROM {{commercial.billing_statements}}
), highest AS (
  SELECT year, max(sequence_number) AS sequence_number
  FROM parsed
  WHERE year IS NOT NULL AND sequence_number IS NOT NULL
  GROUP BY year
), bad_statements AS (
  SELECT id FROM parsed
  WHERE year IS NULL OR sequence_number IS NULL
), bad_sequences AS (
  SELECT statement.id
  FROM parsed AS statement
  LEFT JOIN {{commercial.billing_statement_sequences}} AS sequence ON sequence.year = statement.year
  WHERE statement.year IS NOT NULL AND statement.sequence_number IS NOT NULL
    AND (sequence.year IS NULL OR sequence.next_number <= statement.sequence_number)
)
SELECT id::text AS opaque_id FROM bad_statements
UNION ALL
SELECT id::text FROM bad_sequences`,
  },
  {
    id: 'audit_chain_integrity',
    owner: 'platform-ops',
    description: 'Audit rows have valid hashes, a single root, existing parents, and no forks.',
    blocking: true,
    tables: [['platform-ops', 'audit_logs']],
    query: `WITH roots AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM {{platform-ops.audit_logs}} WHERE previous_hash IS NULL
), bad_roots AS (SELECT id FROM roots WHERE position > 1),
missing_root AS (
  SELECT id FROM {{platform-ops.audit_logs}}
  WHERE NOT EXISTS (SELECT 1 FROM {{platform-ops.audit_logs}} WHERE previous_hash IS NULL)
),
bad_hashes AS (
  SELECT id FROM {{platform-ops.audit_logs}}
  WHERE immutable_hash !~ '^[0-9a-f]{64}$'
), orphans AS (
  SELECT child.id FROM {{platform-ops.audit_logs}} AS child
  WHERE child.previous_hash IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM {{platform-ops.audit_logs}} AS parent WHERE parent.immutable_hash = child.previous_hash)
), forked_hashes AS (
  SELECT previous_hash FROM {{platform-ops.audit_logs}}
  WHERE previous_hash IS NOT NULL GROUP BY previous_hash HAVING count(*) > 1
), forks AS (
  SELECT child.id FROM {{platform-ops.audit_logs}} AS child
  JOIN forked_hashes ON forked_hashes.previous_hash = child.previous_hash
)
SELECT id::text AS opaque_id FROM bad_roots
UNION ALL SELECT id::text FROM missing_root
UNION ALL SELECT id::text FROM bad_hashes
UNION ALL SELECT id::text FROM orphans
UNION ALL SELECT id::text FROM forks`,
  },
  {
    id: 'audit_chain_head_state',
    owner: 'platform-ops',
    description: 'The audit chain head points to the immutable hash recorded on that audit row.',
    blocking: true,
    tables: [['platform-ops', 'audit_chain_locks'], ['platform-ops', 'audit_logs']],
    query: `SELECT chain.id::text AS opaque_id
FROM {{platform-ops.audit_chain_locks}} AS chain
LEFT JOIN {{platform-ops.audit_logs}} AS head ON head.id = chain.head_id
WHERE (chain.head_id IS NULL AND EXISTS (SELECT 1 FROM {{platform-ops.audit_logs}}))
   OR (chain.head_id IS NOT NULL AND (head.id IS NULL OR chain.head_hash IS DISTINCT FROM head.immutable_hash))
UNION ALL
SELECT 'audit-chain-lock-missing'::text
WHERE EXISTS (SELECT 1 FROM {{platform-ops.audit_logs}})
  AND NOT EXISTS (SELECT 1 FROM {{platform-ops.audit_chain_locks}})`,
  },
  {
    id: 'pare_review_payload_digest',
    owner: 'platform-ops',
    description: 'PARE approval review payloads match their stored audit digest.',
    blocking: true,
    tables: [['platform-ops', 'ai_approval_records'], ['platform-ops', 'ai_audit_logs']],
    query: `SELECT approval.id::text AS opaque_id
FROM {{platform-ops.ai_approval_records}} AS approval
JOIN {{platform-ops.ai_audit_logs}} AS audit ON audit.id = approval.ai_audit_log_id
WHERE approval.feature_name = 'PARE'
  AND audit.feature_name = 'PARE'
  AND (audit.sanitized_payload->>'pareProvenanceVersion' = '1' OR audit.sanitized_payload ? 'reviewPayloadDigest')
  AND (jsonb_typeof(approval.review_payload) IS DISTINCT FROM 'object'
    OR COALESCE(audit.sanitized_payload->>'reviewPayloadDigest', '') !~ '^[0-9a-f]{64}$'
    OR encode(sha256(convert_to(approval.review_payload::text, 'UTF8')), 'hex') <> audit.sanitized_payload->>'reviewPayloadDigest')`,
  },
  {
    id: 'invalid_notification_states_or_leases',
    owner: 'platform-ops',
    description: 'Notification states and lease token/expiry fields must be consistent.',
    blocking: true,
    tables: [['platform-ops', 'notification_logs']],
    query: `SELECT id::text AS opaque_id
FROM {{platform-ops.notification_logs}}
WHERE status NOT IN ('queued', 'sent', 'failed')
   OR ((lease_token IS NULL) <> (lease_expires_at IS NULL))
   OR (status <> 'queued' AND lease_token IS NOT NULL)
   OR attempts < 0`,
  },
  {
    id: 'stale_notification_leases',
    owner: 'platform-ops',
    description: 'Expired queued notification leases require owner review; this tool never repairs them.',
    blocking: false,
    tables: [['platform-ops', 'notification_logs']],
    query: `SELECT id::text AS opaque_id FROM {{platform-ops.notification_logs}}
WHERE status = 'queued' AND lease_token IS NOT NULL AND lease_expires_at < now()`,
  },
  {
    id: 'invalid_pare_dispatch_states_or_leases',
    owner: 'platform-ops',
    description: 'PARE dispatch states and lease token/expiry fields must be consistent.',
    blocking: true,
    tables: [['platform-ops', 'pare_dispatches']],
    query: `SELECT id::text AS opaque_id
FROM {{platform-ops.pare_dispatches}}
WHERE status NOT IN ('queued', 'succeeded', 'failed')
   OR ((lease_token IS NULL) <> (lease_expires_at IS NULL))
   OR (status <> 'queued' AND lease_token IS NOT NULL)
   OR attempts < 0`,
  },
  {
    id: 'stale_pare_dispatch_leases',
    owner: 'platform-ops',
    description: 'Expired queued PARE leases require owner review; this tool never repairs them.',
    blocking: false,
    tables: [['platform-ops', 'pare_dispatches']],
    query: `SELECT id::text AS opaque_id FROM {{platform-ops.pare_dispatches}}
WHERE status = 'queued' AND lease_token IS NOT NULL AND lease_expires_at < now()`,
  },
];

const HISTORICAL_PAYLOADS = [
  { domain: 'floorplan', table: 'published_snapshots', columns: ['floor_plan'] },
  { domain: 'event-lifecycle', table: 'addenda', columns: ['contract_snapshot', 'quote_snapshot'] },
  { domain: 'commercial', table: 'billing_sources', columns: ['line_items', 'payment_schedule', 'payment_methods'] },
  { domain: 'commercial', table: 'billing_statements', columns: ['line_items', 'payment_schedule', 'payment_methods'] },
];

function quoteIdentifier(identifier) {
  if (typeof identifier !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error('preflight received an invalid PostgreSQL identifier');
  }
  return '"' + identifier + '"';
}

function qualifiedName(schema, table) {
  return quoteIdentifier(schema) + '.' + quoteIdentifier(table);
}

function parseDatabaseName(connectionString) {
  return decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
}

export function resolveDisposablePreflightTarget({ env = process.env, rawUrl = env[PREFLIGHT_URL_ENV], cwd = process.cwd() } = {}) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new Error(PREFLIGHT_URL_ENV + ' must explicitly name a loopback disposable database; shared database variables are not used.');
  }
  const connection = normalizeDatabaseConnection(rawUrl, {
    purpose: 'migration',
    source: PREFLIGHT_URL_ENV,
    env,
    cwd,
  });
  const databaseName = parseDatabaseName(connection.connectionString);
  if (!connection.isLoopback || !SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error('DDD preflight only accepts a loopback database named prism_p0 or prism_preflight_*, prism_upgrade_*, or prism_restore_*.');
  }
  return { ...connection, databaseName };
}

export function resolveProtectedArtifactPath(requestedPath, { repoRoot = REPO_ROOT } = {}) {
  if (typeof requestedPath !== 'string' || requestedPath.trim() === '' || !path.isAbsolute(requestedPath)) {
    throw new Error('preflight requires an absolute artifact path outside the repository.');
  }
  const absolute = path.resolve(requestedPath);
  const rel = path.relative(path.resolve(repoRoot), absolute);
  if (rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) {
    throw new Error('preflight artifact must be outside the repository.');
  }
  if (path.extname(absolute).toLowerCase() !== '.json') {
    throw new Error('preflight artifact path must end in .json.');
  }
  return absolute;
}

function parseArguments(argv) {
  let artifactPath;
  let final = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--final') {
      final = true;
    } else if (argument === '--artifact') {
      artifactPath = argv[index + 1];
      index += 1;
    } else {
      throw new Error('unknown argument: ' + argument);
    }
  }
  if (!artifactPath) throw new Error('preflight requires --artifact <absolute-private-path.json>.');
  return { artifactPath, final };
}

function ownerForTable(manifest, domain, table) {
  const matches = manifest.ownership.filter((entry) => entry.domain === domain && entry.table === table);
  if (matches.length !== 1) throw new Error('ownership manifest must map ' + domain + '.' + table + ' exactly once');
  return matches[0];
}

function parseReferenceColumns(definition) {
  const match = definition.match(/\bREFERENCES\s+[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\s*\(([^)]+)\)/i);
  if (!match) throw new Error('ownership manifest contains an unsupported foreign key definition');
  return match[1].split(',').map((column) => column.trim().replaceAll('"', '').toLowerCase());
}

function parseAction(definition, action) {
  const match = definition.match(new RegExp('\\bON\\s+' + action + '\\s+(CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION)', 'i'));
  return (match?.[1] ?? 'NO ACTION').replace(/\s+/g, ' ').toUpperCase();
}

function foreignKeySignature(key) {
  return [key.sourceSchema, key.sourceTable, key.name].join('.');
}

export function expectedForeignKeyCatalog(manifest, { final = false } = {}) {
  const expected = [];
  for (const fk of manifest.foreignKeys ?? []) {
    if (final && !fk.sameDomain) continue;
    const source = ownerForTable(manifest, fk.sourceDomain, fk.table);
    const target = ownerForTable(manifest, fk.targetDomain, fk.targetTable);
    expected.push({
      name: fk.name,
      sourceSchema: final ? source.targetSchema : source.currentSchema,
      sourceTable: fk.table,
      sourceColumns: fk.columns.map((column) => column.toLowerCase()),
      targetSchema: final ? target.targetSchema : target.currentSchema,
      targetTable: fk.targetTable,
      targetColumns: parseReferenceColumns(fk.definition),
      onDelete: parseAction(fk.definition, 'DELETE'),
      onUpdate: parseAction(fk.definition, 'UPDATE'),
      validated: true,
      deferrable: false,
      initiallyDeferred: false,
    });
  }
  const signatures = expected.map(foreignKeySignature);
  if (new Set(signatures).size !== signatures.length) throw new Error('ownership manifest contains duplicate foreign key identities');
  return expected;
}

export function buildDddPrechecks(manifest, { final = false } = {}) {
  return PRECHECK_DECLARATIONS.map((declaration) => {
    const query = renderOwnerTableReferences(declaration.query, manifest, { final });
    assertReadOnlyQuery(query, 'preflight ' + declaration.id);
    return { ...declaration, query };
  });
}

export function buildCrossEventChecks(manifest, columnsByTable, { final = false } = {}) {
  const checks = [];
  for (const fk of manifest.foreignKeys ?? []) {
    if (!fk.sameDomain || fk.columns.length !== 1) continue;
    const source = ownerForTable(manifest, fk.sourceDomain, fk.table);
    const target = ownerForTable(manifest, fk.targetDomain, fk.targetTable);
    const sourceSchema = final ? source.targetSchema : source.currentSchema;
    const targetSchema = final ? target.targetSchema : target.currentSchema;
    const sourceColumns = columnsByTable.get(sourceSchema + '.' + fk.table);
    const targetColumns = columnsByTable.get(targetSchema + '.' + fk.targetTable);
    if (!sourceColumns?.has('event_id') || !sourceColumns.has('id') || !targetColumns?.has('event_id')) continue;
    const targetColumnsInFk = parseReferenceColumns(fk.definition);
    if (targetColumnsInFk.length !== 1) continue;
    const query = `SELECT source.id::text AS opaque_id
FROM ${qualifiedName(sourceSchema, fk.table)} AS source
JOIN ${qualifiedName(targetSchema, fk.targetTable)} AS target
  ON source.${quoteIdentifier(fk.columns[0])} = target.${quoteIdentifier(targetColumnsInFk[0])}
WHERE source.event_id IS NOT NULL
  AND target.event_id IS NOT NULL
  AND source.event_id <> target.event_id`;
    assertReadOnlyQuery(query, 'preflight cross-event ' + fk.name);
    checks.push({
      id: 'cross_event_local_link_' + fk.name,
      owner: fk.sourceDomain,
      description: 'Local relation ' + fk.name + ' points to a record owned by another event.',
      blocking: true,
      query,
    });
  }
  return checks;
}

async function inspectPhysicalTables(client, manifest, { final = false } = {}) {
  const current = domainPersistenceCatalog(manifest);
  const target = domainPersistenceCatalog(manifest, { final: true });
  const active = final ? target : current;
  const schemas = [...new Set([...current.schemas, ...target.schemas, 'public'])].sort();
  const schemaResult = await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1::text[]) ORDER BY schema_name`,
    [schemas],
  );
  const presentSchemas = new Set(schemaResult.rows.map(({ schema_name }) => schema_name));
  const tableResult = await client.query(
    `SELECT namespace.nspname AS table_schema, relation.relname AS table_name, relation.oid::text AS oid
       FROM pg_class AS relation
       JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE relation.relkind IN ('r', 'p')
        AND namespace.nspname = ANY($1::text[])
      ORDER BY namespace.nspname, relation.relname`,
    [schemas],
  );
  const actual = tableResult.rows.map(({ table_schema, table_name, oid }) => ({ schema: table_schema, table: table_name, oid }));
  const actualKeys = new Set(actual.map(({ schema, table }) => schema + '.' + table));
  const allowedKeys = new Set([
    ...current.tables.map(({ schema, table }) => schema + '.' + table),
    ...target.tables.map(({ schema, table }) => schema + '.' + table),
    'public._prisma_migrations',
  ]);
  const activeKeys = active.tables.map(({ schema, table }) => schema + '.' + table);
  const missingTables = activeKeys.filter((key) => !actualKeys.has(key));
  const unexpectedTables = actual
    .map(({ schema, table }) => schema + '.' + table)
    .filter((key) => !allowedKeys.has(key));
  const collisions = [];
  const oldSchemaLeftovers = [];
  for (const entry of manifest.ownership) {
    if (entry.currentSchema === entry.targetSchema) continue;
    const oldKey = entry.currentSchema + '.' + entry.table;
    const newKey = entry.targetSchema + '.' + entry.table;
    const hasOld = actualKeys.has(oldKey);
    const hasNew = actualKeys.has(newKey);
    if (hasOld && hasNew) collisions.push({ domain: entry.domain, table: entry.table });
    if (final && hasOld) oldSchemaLeftovers.push({ domain: entry.domain, table: entry.table });
  }
  const missingSchemas = active.schemas.filter((schema) => !presentSchemas.has(schema));
  return {
    schemas,
    activeTableCount: active.tables.length,
    actual,
    missingSchemas,
    missingTables,
    unexpectedTables,
    collisions,
    oldSchemaLeftovers,
    matchesActiveLayout: missingSchemas.length === 0 && missingTables.length === 0 &&
      unexpectedTables.length === 0 && collisions.length === 0 && oldSchemaLeftovers.length === 0,
  };
}

const FOREIGN_KEY_QUERY = `SELECT constraint_row.conname AS name,
       source_namespace.nspname AS source_schema,
       source_table.relname AS source_table,
       target_namespace.nspname AS target_schema,
       target_table.relname AS target_table,
       ARRAY(SELECT source_column.attname
               FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, position)
               JOIN pg_attribute AS source_column ON source_column.attrelid = source_table.oid AND source_column.attnum = key_column.attnum
              ORDER BY key_column.position) AS source_columns,
       ARRAY(SELECT target_column.attname
               FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_column(attnum, position)
               JOIN pg_attribute AS target_column ON target_column.attrelid = target_table.oid AND target_column.attnum = key_column.attnum
              ORDER BY key_column.position) AS target_columns,
       constraint_row.confdeltype::text AS delete_action,
       constraint_row.confupdtype::text AS update_action,
       constraint_row.convalidated AS validated,
       constraint_row.condeferrable AS deferrable,
       constraint_row.condeferred AS initially_deferred
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS source_table ON source_table.oid = constraint_row.conrelid
  JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_table.relnamespace
  JOIN pg_class AS target_table ON target_table.oid = constraint_row.confrelid
  JOIN pg_namespace AS target_namespace ON target_namespace.oid = target_table.relnamespace
 WHERE constraint_row.contype = 'f'
   AND source_namespace.nspname = ANY($1::text[])
 ORDER BY source_namespace.nspname, source_table.relname, constraint_row.conname`;

function normalizeActualForeignKey(row) {
  return {
    name: row.name,
    sourceSchema: row.source_schema,
    sourceTable: row.source_table,
    sourceColumns: row.source_columns.map((column) => column.toLowerCase()),
    targetSchema: row.target_schema,
    targetTable: row.target_table,
    targetColumns: row.target_columns.map((column) => column.toLowerCase()),
    onDelete: ACTION_CODES[row.delete_action] ?? 'UNKNOWN',
    onUpdate: ACTION_CODES[row.update_action] ?? 'UNKNOWN',
    validated: row.validated,
    deferrable: row.deferrable,
    initiallyDeferred: row.initially_deferred,
  };
}

function sameForeignKey(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function inspectForeignKeys(client, manifest, schemas, { final = false } = {}) {
  const actualRows = await client.query(FOREIGN_KEY_QUERY, [schemas]);
  const actual = actualRows.rows.map(normalizeActualForeignKey);
  const expected = expectedForeignKeyCatalog(manifest, { final });
  const actualByKey = new Map(actual.map((entry) => [foreignKeySignature(entry), entry]));
  const expectedByKey = new Map(expected.map((entry) => [foreignKeySignature(entry), entry]));
  const missing = expected.filter((entry) => !actualByKey.has(foreignKeySignature(entry))).map(foreignKeySignature);
  const unexpected = actual.filter((entry) => !expectedByKey.has(foreignKeySignature(entry))).map(foreignKeySignature);
  const mismatched = expected.flatMap((entry) => {
    const present = actualByKey.get(foreignKeySignature(entry));
    return present && !sameForeignKey(entry, present) ? [{ key: foreignKeySignature(entry), expected: entry, actual: present }] : [];
  });
  return {
    expectedCount: expected.length,
    actualCount: actual.length,
    missing,
    unexpected,
    mismatched,
    matchesManifest: missing.length === 0 && unexpected.length === 0 && mismatched.length === 0,
    definitions: actual,
  };
}

async function inspectMigrationLedger(client, migrationRoot) {
  const expectedMigrations = discoverMigrations(migrationRoot);
  const expectedByName = new Map(expectedMigrations.map((migration) => [migration.name, migration]));
  const result = await client.query(
    `SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
       FROM public._prisma_migrations
      ORDER BY started_at NULLS FIRST, migration_name`,
  );
  const rows = result.rows;
  const completed = rows.filter((row) => row.finished_at && !row.rolled_back_at);
  const activeCounts = new Map();
  for (const row of completed) activeCounts.set(row.migration_name, (activeCounts.get(row.migration_name) ?? 0) + 1);
  const unknown = [...new Set(completed.filter((row) => !expectedByName.has(row.migration_name)).map((row) => row.migration_name))];
  const checksumMismatches = completed.flatMap((row) => {
    const expected = expectedByName.get(row.migration_name);
    if (!expected) return [];
    const checksum = createHash('sha256').update(expected.sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8').digest('hex');
    return row.checksum !== checksum ? [row.migration_name] : [];
  });
  const unresolved = rows.filter((row) => !row.finished_at && !row.rolled_back_at).map((row) => row.migration_name);
  const duplicateCompleted = [...activeCounts].filter(([, count]) => count > 1).map(([name]) => name);
  const appliedNames = new Set(completed.map((row) => row.migration_name));
  const pending = expectedMigrations.filter(({ name }) => !appliedNames.has(name)).map(({ name }) => name);
  return {
    expectedCount: expectedMigrations.length,
    appliedCount: appliedNames.size,
    pending,
    unknown,
    checksumMismatches,
    unresolved,
    duplicateCompleted,
    matchesExpectedHistory: unknown.length === 0 && checksumMismatches.length === 0 && unresolved.length === 0 && duplicateCompleted.length === 0,
  };
}

async function inspectColumns(client, schemas) {
  const result = await client.query(
    `SELECT table_schema, table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = ANY($1::text[])
      ORDER BY table_schema, table_name, ordinal_position`,
    [schemas],
  );
  const columnsByTable = new Map();
  for (const row of result.rows) {
    const key = row.table_schema + '.' + row.table_name;
    if (!columnsByTable.has(key)) columnsByTable.set(key, new Set());
    columnsByTable.get(key).add(row.column_name);
  }
  return columnsByTable;
}

async function captureTableFingerprints(client, physical, columnsByTable) {
  const oidByKey = new Map(physical.actual.map(({ schema, table, oid }) => [schema + '.' + table, oid]));
  const fingerprintSql = physical.actual.map(({ schema, table }) => {
    const key = schema + '.' + table;
    const qualified = qualifiedName(schema, table);
    const columns = columnsByTable.get(key) ?? new Set();
    const keySamples = columns.has('id')
      ? `COALESCE((SELECT array_agg(sample.opaque_id) FROM (SELECT id::text AS opaque_id FROM ${qualified} ORDER BY id LIMIT ${SAMPLE_LIMIT}) AS sample), ARRAY[]::text[])`
      : 'ARRAY[]::text[]';
    return `SELECT '${schema}'::text AS schema, '${table}'::text AS table,
                   (SELECT count(*)::text FROM ${qualified}) AS row_count,
                   ${keySamples} AS key_samples`;
  }).join('\nUNION ALL\n');
  const fingerprintResult = await client.query(fingerprintSql);
  const counts = fingerprintResult.rows.map(({ schema, table, row_count, key_samples }) => ({
    schema,
    table,
    rowCount: String(row_count ?? '0'),
    ...(oidByKey.has(schema + '.' + table) ? { oid: String(oidByKey.get(schema + '.' + table)) } : {}),
  }));
  const keys = fingerprintResult.rows.map(({ schema, table, key_samples }) => ({
    schema,
    table,
    kind: columnsByTable.get(schema + '.' + table)?.has('id') ? 'opaque-id' : 'none',
    samples: Array.isArray(key_samples) ? key_samples.map(String) : [],
  }));

  const constraintRows = await client.query(
    `SELECT source_namespace.nspname AS schema, source_table.relname AS table,
            constraint_row.conname AS name, constraint_row.contype::text AS kind,
            pg_get_constraintdef(constraint_row.oid, true) AS definition,
            constraint_row.convalidated AS validated
       FROM pg_constraint AS constraint_row
       JOIN pg_class AS source_table ON source_table.oid = constraint_row.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_table.relnamespace
      WHERE source_namespace.nspname = ANY($1::text[])
      ORDER BY source_namespace.nspname, source_table.relname, constraint_row.conname`,
    [physical.schemas],
  );
  const indexRows = await client.query(
    `SELECT schemaname AS schema, tablename AS table, indexname AS name, indexdef AS definition
       FROM pg_indexes
      WHERE schemaname = ANY($1::text[])
      ORDER BY schemaname, tablename, indexname`,
    [physical.schemas],
  );
  return { tableCounts: counts, keySamples: keys, constraints: constraintRows.rows, indexes: indexRows.rows };
}

async function capturePayloadChecksums(client, manifest, { final = false } = {}) {
  const snapshots = [];
  for (const payload of HISTORICAL_PAYLOADS) {
    const owner = ownerForTable(manifest, payload.domain, payload.table);
    const schema = final ? owner.targetSchema : owner.currentSchema;
    const table = qualifiedName(schema, payload.table);
    const columns = payload.columns.map(quoteIdentifier).join(', ');
    const result = await client.query(
      `SELECT id::text AS opaque_id,
              encode(sha256(convert_to(jsonb_build_array(${columns})::text, 'UTF8')), 'hex') AS payload_checksum
         FROM ${table}
        ORDER BY id`,
    );
    snapshots.push({ domain: payload.domain, table: payload.table, rows: result.rows.map(({ opaque_id, payload_checksum }) => ({ id: String(opaque_id), checksum: payload_checksum })) });
  }
  return snapshots;
}

async function captureMoneyTotals(client, manifest, { final = false } = {}) {
  const references = [
    ['commercial', 'billing_sources', 'total_amount'],
    ['commercial', 'billing_statements', 'total_amount'],
    ['commercial', 'payment_records', 'amount_received'],
    ['commercial', 'payment_milestones', 'amount_paid'],
  ];
  const values = [];
  for (const [domain, table, column] of references) {
    const owner = ownerForTable(manifest, domain, table);
    const schema = final ? owner.targetSchema : owner.currentSchema;
    const result = await client.query(
      'SELECT COALESCE(sum(' + quoteIdentifier(column) + '), 0)::text AS total FROM ' + qualifiedName(schema, table),
    );
    values.push({ domain, table, column, total: String(result.rows[0]?.total ?? '0') });
  }
  return values;
}

async function runViolationChecks(client, checks, presentActiveTables, manifest, { final = false } = {}) {
  const outcomes = [];
  for (const check of checks) {
    const required = (check.tables ?? []).map(([domain, table]) => {
      const owner = ownerForTable(manifest, domain, table);
      return (final ? owner.targetSchema : owner.currentSchema) + '.' + table;
    });
    if (required.some((key) => !presentActiveTables.has(key))) {
      outcomes.push({ id: check.id, owner: check.owner, blocking: check.blocking, status: 'not-run', violationCount: '0', sampleOpaqueIds: [] });
      continue;
    }
    try {
      const query = `WITH violations AS (${check.query})
SELECT (SELECT count(*)::text FROM violations) AS violation_count,
       COALESCE((SELECT array_agg(opaque_id) FROM (SELECT opaque_id FROM violations ORDER BY opaque_id LIMIT $1) AS sample), ARRAY[]::text[]) AS sample_ids`;
      assertReadOnlyQuery(query, 'preflight ' + check.id);
      const result = await client.query(query, [SAMPLE_LIMIT]);
      const row = result.rows[0] ?? { violation_count: '0', sample_ids: [] };
      outcomes.push({
        id: check.id,
        owner: check.owner,
        blocking: check.blocking,
        status: String(row.violation_count ?? '0') === '0' ? 'passed' : 'review',
        violationCount: String(row.violation_count ?? '0'),
        sampleOpaqueIds: Array.isArray(row.sample_ids) ? row.sample_ids.map(String) : [],
      });
    } catch (error) {
      const code = error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : 'QUERY_FAILED';
      outcomes.push({ id: check.id, owner: check.owner, blocking: true, status: 'error', violationCount: null, sampleOpaqueIds: [], databaseCode: code });
    }
  }
  return outcomes;
}

export async function runDddPreflight({
  env = process.env,
  PoolClass = Pool,
  rawUrl = env[PREFLIGHT_URL_ENV],
  artifactPath,
  final = false,
  now = new Date(),
  manifest = loadOwnershipManifest(),
  migrationRoot = path.resolve(API_ROOT, 'prisma', 'migrations'),
} = {}) {
  const target = resolveDisposablePreflightTarget({ env, rawUrl });
  const privateArtifactPath = resolveProtectedArtifactPath(artifactPath);
  const pool = new PoolClass({ connectionString: target.connectionString, ssl: target.ssl, max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 });
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionStarted = true;
    const identityResult = await client.query(`SELECT current_database() AS database_name, current_setting('server_version_num') AS server_version_num`);
    const identity = identityResult.rows[0] ?? {};
    if (identity.database_name !== target.databaseName) throw new Error('connected database does not match the explicit disposable target');

    const physical = await inspectPhysicalTables(client, manifest, { final });
    const columnsByTable = await inspectColumns(client, physical.schemas);
    const foreignKeys = await inspectForeignKeys(client, manifest, physical.schemas, { final });
    const migrationLedger = await inspectMigrationLedger(client, migrationRoot);
    const activeCatalog = final ? domainPersistenceCatalog(manifest, { final: true }) : domainPersistenceCatalog(manifest);
    const activeKeysForFingerprint = new Set(activeCatalog.tables.map(({ schema, table }) => schema + '.' + table));
    activeKeysForFingerprint.add('public._prisma_migrations');
    const fingerprintPhysical = {
      ...physical,
      actual: physical.actual.filter(({ schema, table }) => activeKeysForFingerprint.has(schema + '.' + table)),
    };
    const tableFingerprints = physical.missingTables.length === 0
      ? await captureTableFingerprints(client, fingerprintPhysical, columnsByTable)
      : { tableCounts: [], keySamples: [], constraints: [], indexes: [] };
    const tableOids = physical.actual.map(({ schema, table, oid }) => ({ schema, table, oid }));
    const checks = buildDddPrechecks(manifest, { final });
    const crossEventChecks = buildCrossEventChecks(manifest, columnsByTable, { final });
    const activeKeys = new Set((final ? domainPersistenceCatalog(manifest, { final: true }) : domainPersistenceCatalog(manifest)).tables.map(({ schema, table }) => schema + '.' + table));
    const presentActiveTables = new Set([...activeKeys].filter((key) => physical.actual.some(({ schema, table }) => schema + '.' + table === key)));
    const checkResults = physical.missingTables.length === 0
      ? await runViolationChecks(client, [...checks, ...crossEventChecks], presentActiveTables, manifest, { final })
      : [];
    const payloadChecksums = physical.missingTables.length === 0 ? await capturePayloadChecksums(client, manifest, { final }) : [];
    const moneyTotals = physical.missingTables.length === 0 ? await captureMoneyTotals(client, manifest, { final }) : [];
    await client.query('COMMIT');
    transactionStarted = false;

    const blockingChecks = checkResults.filter((check) => check.blocking && (check.status === 'review' || check.status === 'error' || check.status === 'not-run'));
    const ownerReviewChecks = checkResults.filter((check) => !check.blocking && check.violationCount !== '0');
    const blockers = [
      ...(physical.matchesActiveLayout ? [] : ['catalog_layout']),
      ...(foreignKeys.matchesManifest ? [] : ['foreign_key_catalog']),
      ...(migrationLedger.matchesExpectedHistory ? [] : ['migration_ledger']),
      ...blockingChecks.map(({ id }) => 'data:' + id),
    ];
    const report = {
      createdAt: now.toISOString(),
      schemaMode: final ? 'final' : 'current',
      target: { databaseName: target.databaseName, serverVersionNum: String(identity.server_version_num ?? '') },
      status: blockers.length > 0 ? 'blocked' : ownerReviewChecks.length > 0 ? 'review-required' : 'ready',
      blockers,
      catalog: {
        expectedTableCount: physical.activeTableCount,
        missingSchemas: physical.missingSchemas,
        missingTables: physical.missingTables,
        unexpectedTables: physical.unexpectedTables,
        collisions: physical.collisions,
        oldSchemaLeftovers: physical.oldSchemaLeftovers,
        matchesActiveLayout: physical.matchesActiveLayout,
      },
      foreignKeys,
      migrationLedger,
      tableOids,
      tableFingerprints,
      historicalPayloadChecksums: payloadChecksums,
      moneyTotals,
      checks: checkResults,
      ownerReviewCheckIds: ownerReviewChecks.map(({ id }) => id),
    };
    await persistProtectedArtifact(privateArtifactPath, report);
    return { report, artifactPath: privateArtifactPath };
  } catch (error) {
    if (transactionStarted && client) {
      try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function persistProtectedArtifact(artifactPath, report) {
  const parent = path.dirname(artifactPath);
  try {
    const parentStat = await stat(parent);
    if (!parentStat.isDirectory()) throw new Error('artifact parent is not a directory');
  } catch {
    throw new Error('preflight artifact parent must be an existing protected directory.');
  }
  const temporaryPath = artifactPath + '.' + process.pid + '.tmp';
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(report, null, 2) + '\n', 'utf8');
    await handle.close();
    handle = undefined;
    await link(temporaryPath, artifactPath);
    await unlink(temporaryPath);
  } catch {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw new Error('could not write the protected preflight artifact; identifiers were not printed.');
  }
}

function printAggregateReport({ report, artifactPath }) {
  const count = (items) => items.length;
  const findingCount = report.checks.reduce((sum, check) => sum + (check.violationCount && /^\d+$/.test(check.violationCount) ? BigInt(check.violationCount) : 0n), 0n);
  console.log('DDD preflight ' + report.status + ' (' + report.schemaMode + ' schema mode).');
  console.log('Tables expected: ' + report.catalog.expectedTableCount + '; missing: ' + count(report.catalog.missingTables) + '; unexpected: ' + count(report.catalog.unexpectedTables) + '; collisions: ' + count(report.catalog.collisions) + '.');
  console.log('Foreign keys expected: ' + report.foreignKeys.expectedCount + '; actual: ' + report.foreignKeys.actualCount + '; discrepancies: ' + (count(report.foreignKeys.missing) + count(report.foreignKeys.unexpected) + count(report.foreignKeys.mismatched)) + '.');
  console.log('Migrations applied: ' + report.migrationLedger.appliedCount + '/' + report.migrationLedger.expectedCount + '; pending: ' + count(report.migrationLedger.pending) + '; unexpected state: ' + (!report.migrationLedger.matchesExpectedHistory) + '.');
  console.log('Data findings: ' + findingCount.toString() + '; owner-review categories: ' + count(report.ownerReviewCheckIds) + '.');
  console.log('Protected report: ' + artifactPath);
}

async function main() {
  const { artifactPath, final } = parseArguments(process.argv.slice(2));
  const outcome = await runDddPreflight({ artifactPath, final });
  printAggregateReport(outcome);
  if (outcome.report.status !== 'ready') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href) {
  main().catch(() => {
    console.error('DDD preflight stopped. It requires the explicit loopback disposable target and a protected artifact directory; no database values were printed.');
    process.exitCode = 1;
  });
}
