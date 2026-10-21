import assert from 'node:assert/strict';
import test from 'node:test';
import { directDatabaseHost, parseRepairArguments, validateApplyEvidence } from './repair-audit-chain.mjs';

test('repair rejects complete pooler hostnames while permitting distinct direct hosts', () => {
  for (const hostname of ['pooler.supabase.com', 'aws-0.pooler.supabase.com', 'AWS-0.POOLER.SUPABASE.COM']) {
    assert.throws(() => directDatabaseHost(`postgresql://user:pass@${hostname}:5432/prism`), /points to a pooler/);
  }
  for (const hostname of ['notpooler.supabase.com', 'pooler.supabase.com.example.test', 'pooler.supabase.comevil.test']) {
    assert.equal(directDatabaseHost(`postgresql://user:pass@${hostname}:5432/prism`), `${hostname}:5432`);
  }
  assert.throws(() => directDatabaseHost('postgresql://user:pass@db.example.test:6543/prism'), /points to a pooler/);
});

test('repair command defaults to a read-only dry run', () => {
  assert.deepEqual(parseRepairArguments([]), { apply: false, dryrun: true });
});

test('repair apply requires explicit target, digest, backup, approval, and history rewrite acknowledgement', () => {
  assert.throws(() => parseRepairArguments(['--apply']), /Missing required apply option/);
  assert.throws(() => parseRepairArguments([
    '--apply',
    '--environment=preproduction',
    '--expected-database=prism_preprod',
    '--expected-host=db.preprod.test:5432',
    `--expected-source-sha256=${'a'.repeat(64)}`,
    '--backup-reference=backup-123',
    '--approval-reference=owner-123',
    '--snapshot-file=C:\\secure\\audit-before.json',
  ]), /acknowledge-historical-hash-rewrite/);
  assert.deepEqual(parseRepairArguments([
    '--apply',
    '--environment=preproduction',
    '--expected-database=prism_preprod',
    '--expected-host=db.preprod.test:5432',
    `--expected-source-sha256=${'a'.repeat(64)}`,
    '--backup-reference=backup-123',
    '--approval-reference=owner-123',
    '--snapshot-file=C:\\secure\\audit-before.json',
    '--acknowledge-historical-hash-rewrite',
  ]), {
    apply: true,
    environment: 'preproduction',
    expecteddatabase: 'prism_preprod',
    expectedhost: 'db.preprod.test:5432',
    expectedsourcesha256: 'a'.repeat(64),
    backupreference: 'backup-123',
    approvalreference: 'owner-123',
    snapshotfile: 'C:\\secure\\audit-before.json',
    acknowledgehistoricalhashrewrite: true,
  });
});

test('repair apply refuses production and a mismatched environment or database', () => {
  const options = {
    environment: 'preproduction',
    expecteddatabase: 'prism_preprod',
    expectedhost: 'db.preprod.test:5432',
    backupreference: 'backup-123',
    approvalreference: 'owner-123',
  };
  const environment = { NODE_ENV: 'test', PRISM_AUDIT_REPAIR_ENV: 'preproduction' };

  assert.doesNotThrow(() => validateApplyEvidence(options, 'prism_preprod', 'db.preprod.test:5432', environment));
  assert.throws(() => validateApplyEvidence(options, 'prism_production', 'db.preprod.test:5432', environment), /does not match/);
  assert.throws(() => validateApplyEvidence(options, 'prism_preprod', 'db.production.test:5432', environment), /does not match/);
  assert.throws(() => validateApplyEvidence(options, 'prism_preprod', 'db.preprod.test:5432', { ...environment, NODE_ENV: 'production' }), /NODE_ENV=production/);
  assert.throws(() => validateApplyEvidence(options, 'prism_preprod', 'db.preprod.test:5432', { ...environment, PRISM_AUDIT_REPAIR_ENV: 'production' }), /must match/);
  assert.throws(() => validateApplyEvidence({ ...options, environment: 'production' }, 'prism_preprod', 'db.preprod.test:5432', environment), /limited to development/);
});
