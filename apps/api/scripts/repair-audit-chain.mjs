import { createHash, randomUUID } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const allowedEnvironments = new Set(['development', 'staging', 'preproduction']);
const auditHashModulePath = path.resolve(
  scriptDirectory,
  '../dist/apps/api/src/modules/platform-ops/application/trust/audit-hash.js',
);
const auditRepairModulePath = path.resolve(
  scriptDirectory,
  '../dist/apps/api/src/modules/platform-ops/application/trust/audit-chain-repair.js',
);

const auditRowQuery = `
  SELECT
    id,
    event_id AS "eventId",
    actor,
    actor_role AS "actorRole",
    actor_email AS "actorEmail",
    action,
    action_type AS "actionType",
    category,
    affected_type AS "affectedType",
    affected_id AS "affectedId",
    affected_label AS "affectedLabel",
    metadata,
    ip_address AS "ipAddress",
    device,
    severity,
    immutable_hash AS "immutableHash",
    previous_hash AS "previousHash",
    -- Prisma serializes the timestamp-without-time-zone audit column as UTC.
    -- Cast it explicitly so node-postgres does not apply the host's local zone.
    created_at AT TIME ZONE 'UTC' AS "createdAt"
  FROM trust_ops.audit_logs
  ORDER BY created_at ASC, id ASC`;

const lockQuery = `
  SELECT id, revision, head_id AS "headId", head_hash AS "headHash"
  FROM trust_ops.audit_chain_locks
  WHERE id = 'global'`;

export function parseRepairArguments(argv) {
  const valueOptions = new Set([
    '--environment',
    '--expected-database',
    '--expected-host',
    '--expected-source-sha256',
    '--backup-reference',
    '--approval-reference',
    '--snapshot-file',
  ]);
  const booleanOptions = new Set(['--apply', '--dry-run', '--acknowledge-historical-hash-rewrite']);
  const parsed = { apply: false };

  for (let index = 0; index < argv.length; index += 1) {
    const [name, inlineValue] = argv[index].split(/=(.*)/s, 2);
    if (booleanOptions.has(name)) {
      if (inlineValue !== undefined) throw new Error(`${name} does not accept a value`);
      parsed[name.slice(2).replaceAll('-', '')] = true;
      continue;
    }
    if (!valueOptions.has(name)) throw new Error(`Unknown argument: ${name}`);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`A value is required for ${name}`);
    parsed[name.slice(2).replaceAll('-', '')] = value;
  }

  if (parsed.apply && parsed.dryrun) throw new Error('Choose either --dry-run or --apply');
  if (!parsed.apply) parsed.dryrun = true;
  if (parsed.apply) {
    const required = [
      'environment',
      'expecteddatabase',
      'expectedhost',
      'expectedsourcesha256',
      'backupreference',
      'approvalreference',
      'snapshotfile',
    ];
    const missing = required.filter((key) => !parsed[key]);
    if (missing.length > 0) throw new Error(`Missing required apply option(s): ${missing.join(', ')}`);
    if (!parsed.acknowledgehistoricalhashrewrite) {
      throw new Error('Apply requires --acknowledge-historical-hash-rewrite');
    }
    if (!/^[0-9a-f]{64}$/.test(parsed.expectedsourcesha256)) {
      throw new Error('--expected-source-sha256 must be a lowercase SHA-256 digest');
    }
  }

  return parsed;
}

export function validateApplyEvidence(options, database, host, environment) {
  if (!allowedEnvironments.has(options.environment)) {
    throw new Error('Apply is limited to development, staging, or preproduction; production is not supported');
  }
  if (environment.NODE_ENV === 'production') throw new Error('Apply is disabled when NODE_ENV=production');
  if (environment.PRISM_AUDIT_REPAIR_ENV !== options.environment) {
    throw new Error('PRISM_AUDIT_REPAIR_ENV must match --environment');
  }
  if (database !== options.expecteddatabase) {
    throw new Error(`Connected database does not match --expected-database (${database})`);
  }
  if (!/^[A-Za-z0-9.-]+:\d{1,5}$/.test(options.expectedhost)) throw new Error('Expected host must include a port');
  if (host !== options.expectedhost) throw new Error(`Connected host does not match --expected-host (${host})`);
  for (const [label, value] of [
    ['backup reference', options.backupreference],
    ['owner approval reference', options.approvalreference],
  ]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/.test(value)) throw new Error(`Invalid ${label}`);
  }
}

async function resolveSnapshotDestination(snapshotFile) {
  if (!path.isAbsolute(snapshotFile)) throw new Error('--snapshot-file must be an absolute path');
  const repositoryRoot = await realpath(path.resolve(scriptDirectory, '../../..'));
  const parentDirectory = await realpath(path.dirname(snapshotFile));
  const resolvedFile = path.resolve(parentDirectory, path.basename(snapshotFile));
  const relative = path.relative(repositoryRoot, resolvedFile);
  const isInsideRepository = relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  if (isInsideRepository) throw new Error('--snapshot-file must be outside the repository');
  return resolvedFile;
}

async function writeAuditSnapshot(snapshotFile, target, rows, lock, options, sourceSha256) {
  const snapshot = {
    format: 'prism-audit-chain-pre-repair/v1',
    target,
    backupReference: options.backupreference,
    approvalReference: options.approvalreference,
    sourceSha256,
    lock,
    rows,
  };
  const content = JSON.stringify(normalizeSnapshotValue(snapshot), null, 2);
  const snapshotSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const file = await open(snapshotFile, 'wx', 0o600);
  try {
    await file.writeFile(content, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
  return snapshotSha256;
}

function normalizeSnapshotValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => [key, normalizeSnapshotValue(child)]));
}

async function readAuditState(client) {
  const lockResult = await client.query(lockQuery);
  const lock = lockResult.rows[0];
  if (!lock) throw new Error('The global audit chain lock row is missing');
  const auditResult = await client.query(auditRowQuery);
  return { lock, rows: auditResult.rows };
}

function makeCheckpoint(plan, options, target, sourceSha256, snapshotSha256, hashModule) {
  const latestCreatedAt = Math.max(...plan.ordered.map((row) => new Date(row.createdAt).getTime()));
  const createdAt = new Date(Math.max(Date.now(), latestCreatedAt + 1));
  const checkpoint = {
    id: `aud_${randomUUID()}`,
    eventId: null,
    actor: 'Platform Ops Maintenance',
    actorRole: 'system',
    actorEmail: null,
    action: 'Rehashed historical audit chain and recorded maintenance checkpoint',
    actionType: 'update',
    category: 'access',
    affectedType: 'audit_logs',
    affectedId: plan.tailId,
    affectedLabel: `${plan.ordered.length} historical audit rows rehashed`,
    metadata: {
      auditChainRepair: {
        version: 1,
        algorithm: 'prism:audit-chain:v2',
        targetDatabase: target.database,
        targetHost: target.host,
        sourceSha256,
        snapshotSha256,
        rehashedRowCount: plan.ordered.length,
        previousRootId: plan.rootId,
        previousRootHash: plan.oldRootHash,
        previousTailId: plan.tailId,
        previousTailHash: plan.oldTailHash,
        newRootHash: plan.newRootHash,
        newTailHash: plan.newTailHash,
        backupReference: options.backupreference,
        approvalReference: options.approvalreference,
      },
    },
    ipAddress: 'unknown',
    device: 'P.R.I.S.M maintenance CLI',
    severity: 'warning',
    previousHash: plan.newTailHash,
    createdAt,
  };
  return {
    ...checkpoint,
    immutableHash: hashModule.hashCanonicalAuditPayload(hashModule.toAuditHashPayload(checkpoint)),
  };
}

async function insertCheckpoint(client, checkpoint) {
  await client.query(
    `INSERT INTO trust_ops.audit_logs (
      id, event_id, actor, actor_role, actor_email, action, action_type, category,
      affected_type, affected_id, affected_label, metadata, ip_address, device,
      severity, immutable_hash, previous_hash, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14,
      $15, $16, $17, $18::timestamptz AT TIME ZONE 'UTC'
    )`,
    [
      checkpoint.id,
      checkpoint.eventId,
      checkpoint.actor,
      checkpoint.actorRole,
      checkpoint.actorEmail,
      checkpoint.action,
      checkpoint.actionType,
      checkpoint.category,
      checkpoint.affectedType,
      checkpoint.affectedId,
      checkpoint.affectedLabel,
      JSON.stringify(checkpoint.metadata),
      checkpoint.ipAddress,
      checkpoint.device,
      checkpoint.severity,
      checkpoint.immutableHash,
      checkpoint.previousHash,
      checkpoint.createdAt,
    ],
  );
}

function summarize(mode, database, host, rows, lock, plan, sourceSha256, repairModule) {
  return {
    mode,
    database,
    host,
    rowCount: rows.length,
    invalidHashCount: plan.invalidHashCount,
    requiresRehash: plan.invalidHashCount > 0,
    canonicalValid: repairModule.verifyCanonicalAuditChain(rows),
    sourceSha256,
    rootId: plan.rootId,
    tailId: plan.tailId,
    lockedHeadId: lock.headId,
    lockedHeadHash: lock.headHash,
    plannedRootHash: plan.newRootHash,
    plannedTailHash: plan.newTailHash,
  };
}

export async function runAuditChainRepair({
  pool,
  options,
  hashModule,
  repairModule,
  environment = process.env,
  targetHost = directDatabaseHost(environment.DIRECT_URL),
}) {
  const snapshotPath = options.apply ? await resolveSnapshotDestination(options.snapshotfile) : null;
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    if (options.apply) {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      transactionOpen = true;
      const lock = await client.query(`${lockQuery.trim()} FOR UPDATE`);
      if (!lock.rows[0]) throw new Error('The global audit chain lock row is missing');
      await client.query('LOCK TABLE trust_ops.audit_logs IN SHARE ROW EXCLUSIVE MODE');
    } else {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      transactionOpen = true;
    }

    const identity = await client.query('SELECT current_database() AS database');
    const database = identity.rows[0]?.database;
    if (typeof database !== 'string' || database.length === 0) throw new Error('Could not identify the connected database');
    if (options.apply) validateApplyEvidence(options, database, targetHost, environment);
    if (!options.apply && options.expecteddatabase && database !== options.expecteddatabase) {
      throw new Error(`Connected database does not match --expected-database (${database})`);
    }
    if (!options.apply && options.expectedhost && targetHost !== options.expectedhost) {
      throw new Error(`Connected host does not match --expected-host (${targetHost})`);
    }

    const { lock: stateLock, rows } = await readAuditState(client);
    const target = { database, host: targetHost };
    const sourceSha256 = repairModule.computeAuditSourceSha256(target, rows, stateLock);
    const plan = repairModule.planAuditChainRehash(rows);
    repairModule.validateAuditChainLock(stateLock, plan);
    const summary = summarize(options.apply ? 'apply' : 'dry-run', database, targetHost, rows, stateLock, plan, sourceSha256, repairModule);

    if (options.apply) {
      if (sourceSha256 !== options.expectedsourcesha256) {
        throw new Error('Audit rows changed since the dry run; rerun the dry run and review the new digest');
      }
      if (!summary.requiresRehash) throw new Error('The audit chain already verifies; refusing an unnecessary history rewrite');

      const snapshotSha256 = await writeAuditSnapshot(snapshotPath, target, rows, stateLock, options, sourceSha256);

      for (const row of plan.plannedRows) {
        const update = await client.query(
          `UPDATE trust_ops.audit_logs
              SET previous_hash = $2, immutable_hash = $3
            WHERE id = $1`,
          [row.id, row.previousHash, row.immutableHash],
        );
        if (update.rowCount !== 1) throw new Error(`Expected to update one audit row (${row.id})`);
      }

      const checkpoint = makeCheckpoint(plan, options, target, sourceSha256, snapshotSha256, hashModule);
      await insertCheckpoint(client, checkpoint);
      const headUpdate = await client.query(
        `UPDATE trust_ops.audit_chain_locks
            SET revision = revision + 1, head_id = $1, head_hash = $2
          WHERE id = 'global'`,
        [checkpoint.id, checkpoint.immutableHash],
      );
      if (headUpdate.rowCount !== 1) throw new Error('Failed to update the global audit chain head');

      const repaired = await client.query(auditRowQuery);
      if (!repairModule.verifyCanonicalAuditChain(repaired.rows)) {
        throw new Error('Full post-repair audit verification failed; transaction will be rolled back');
      }
      summary.checkpointId = checkpoint.id;
      summary.checkpointHash = checkpoint.immutableHash;
      summary.verifiedRowCount = repaired.rows.length;
      summary.preRepairRowCount = rows.length;
      summary.preRepairInvalidHashCount = plan.invalidHashCount;
      summary.rehashedRowCount = plan.ordered.length;
      summary.previousRootId = plan.rootId;
      summary.previousTailId = plan.tailId;
      summary.previousTailHash = plan.oldTailHash;
      summary.invalidHashCount = 0;
      summary.requiresRehash = false;
      summary.canonicalValid = true;
      summary.rowCount = repaired.rows.length;
      summary.tailId = checkpoint.id;
      summary.snapshotSha256 = snapshotSha256;
      await client.query('COMMIT');
      transactionOpen = false;
      return summary;
    }

    await client.query('ROLLBACK');
    transactionOpen = false;
    return summary;
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function loadCompiledAuditModules() {
  try {
    return {
      hashModule: require(auditHashModulePath),
      repairModule: require(auditRepairModulePath),
    };
  } catch {
    throw new Error('Compiled audit repair helpers are missing; run the API build before this command');
  }
}

function databaseUrlFromEnvironment() {
  const value = process.env.DIRECT_URL?.trim();
  if (!value) throw new Error('DIRECT_URL is required; audit repair does not use a pooled connection');
  const parsed = new URL(value);
  if (parsed.hostname.includes('pooler.supabase.com') || parsed.port === '6543') {
    throw new Error('DIRECT_URL points to a pooler; use the direct PostgreSQL connection for this maintenance operation');
  }
  return { connectionString: value, host: `${parsed.hostname}:${parsed.port || '5432'}` };
}

function directDatabaseHost(value) {
  if (!value) throw new Error('DIRECT_URL is required; audit repair does not use a pooled connection');
  const parsed = new URL(value);
  if (parsed.hostname.includes('pooler.supabase.com') || parsed.port === '6543') {
    throw new Error('DIRECT_URL points to a pooler; use the direct PostgreSQL connection for this maintenance operation');
  }
  return `${parsed.hostname}:${parsed.port || '5432'}`;
}

async function main() {
  const options = parseRepairArguments(process.argv.slice(2));
  const target = databaseUrlFromEnvironment();
  const pool = new Pool({
    connectionString: target.connectionString,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 30_000,
  });
  try {
    const summary = await runAuditChainRepair({ pool, options, targetHost: target.host, ...loadCompiledAuditModules() });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.mode === 'dry-run') {
      console.log('Read-only preview only. No audit rows were changed.');
    } else {
      console.log('Audit history was rehashed and the new checkpoint passed full-chain verification.');
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown failure';
    console.error(`Audit chain repair stopped: ${message}`);
    process.exitCode = 1;
  });
}
