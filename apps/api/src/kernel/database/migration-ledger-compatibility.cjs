const { createHash } = require('node:crypto');

// These six data-only seeds were applied before their gates/dates were revised in ee4d671a.
// Original SQL is preserved in checkpoint e19f7da2f38b6375a060a3a2274e775215e86960.
// Pin both versions: editing the current SQL must never inherit a historical exception.
const historicalDataMigrations = new Map([
  ['20261021104500_event-lifecycle_uat_portal_data', ['1768c315c7b0a53c338c6bf18bea731f4e016d6b4fdfbd7579d1478e405ef69e', 'b2007aec777f5189d66486d3dd3437dbdf902da49a536387c74ac825237803c2']],
  ['20261021104600_commercial_uat_supplier_portal', ['cc8c2b6d76bc6522324a4e7a20a5841ed435d7704ecbb5965199750c1695dabd', '6ccab43b24093903f361d155124aeeb4532db1acb4e666b966f168628e16305e']],
  ['20261021104700_operations_uat_guest_coordinator_data', ['c722c278a6b6942d49731562b98059f7ced38d96bae020626ab80eb1d7a45fc1', '4a1bd73a5c2c514d17bf3ff0df4b98f03daef32fd50eb5510780d56b578d3958']],
  ['20261021104800_live-ops_uat_event_day_data', ['18c4c76d389af2e1e8b6a23205480bf53559a0ae6bbd637ccbff71de528b456f', 'b827ee98d0cc49bc3c6ab1bd23d6c93173dc1a97b35f72ac056b2c02cdc8b13a']],
  ['20261021104900_event-games_uat_guest_lobby', ['084a634af67500f6ffae8807106a1cead9bdf4a33f70c29e0cd4e405240e980d', 'd14d502da52518b7d730df0bd759a96276a91ff56403dd34e0ee7ed0791de0c7']],
  ['20261021105000_platform-ops_uat_privacy_queue', ['28716132fc80103598c6a05812966515e6bf1323ae31c0bc5e7655188a5e7e84', '8e0fc2d3f241ffa444c982a49ea9ec38c062ccd4e718e78635894cbac113733f']],
]);

function historicalMigrationChecksums(name, currentChecksums) {
  const versions = historicalDataMigrations.get(name);
  return versions && currentChecksums.includes(versions[0]) ? [versions[1]] : [];
}

function migrationChecksumVariants(sql, name) {
  if (typeof sql !== 'string' && !Buffer.isBuffer(sql) && !(sql instanceof Uint8Array)) {
    throw new TypeError('Prisma migration SQL must be text or bytes.');
  }
  const raw = Buffer.isBuffer(sql) ? sql : Buffer.from(sql);
  const canonicalSql = raw.toString('utf8').replace(/\r\n?/g, '\n');
  const windowsSql = canonicalSql.replace(/\n/g, '\r\n');
  const checksums = [...new Set([
    createHash('sha256').update(raw).digest('hex'),
    createHash('sha256').update(canonicalSql, 'utf8').digest('hex'),
    createHash('sha256').update(windowsSql, 'utf8').digest('hex'),
  ])];
  return [...checksums, ...historicalMigrationChecksums(name, checksums)];
}
function sortByName(values) {
  return [...values].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

function validateLocalMigrations(localMigrations, requiredHead) {
  const local = sortByName(localMigrations);
  if (local.length === 0) throw new Error('No local Prisma migrations were found.');

  const localByName = new Map();
  for (const migration of local) {
    if (!migration.name.trim() || !migration.checksum.trim()) {
      throw new Error('A local migration is missing its name or checksum.');
    }
    if (localByName.has(migration.name)) {
      throw new Error(`Duplicate local Prisma migration: ${migration.name}.`);
    }
    localByName.set(migration.name, migration);
  }

  const localHead = local[local.length - 1].name;
  if (requiredHead !== localHead) {
    throw new Error(`Required schema head ${requiredHead} does not match local head ${localHead}.`);
  }
  return { local, localByName, localHead };
}

function activeAppliedMigrations(appliedMigrations) {
  const unfinished = appliedMigrations.filter(
    (migration) => migration.finishedAt === null && migration.rolledBackAt === null,
  );
  if (unfinished.length > 0) {
    throw new Error(`Database has unfinished Prisma migrations: ${unfinished.map(({ name }) => name).join(', ')}.`);
  }

  const applied = appliedMigrations.filter(
    (migration) => migration.finishedAt !== null && migration.rolledBackAt === null,
  );
  if (applied.length === 0) throw new Error('Database has no completed Prisma migrations.');

  const seen = new Set();
  for (const migration of applied) {
    if (seen.has(migration.name)) {
      throw new Error(`Database has duplicate active Prisma migration rows: ${migration.name}.`);
    }
    seen.add(migration.name);
  }
  return applied;
}

function assertKnownMigrationPrefix(input) {
  const { local, localByName, localHead } = validateLocalMigrations(input.localMigrations, input.requiredHead);
  const applied = activeAppliedMigrations(input.appliedMigrations);

  for (const migration of applied) {
    const localMigration = localByName.get(migration.name);
    if (!localMigration) throw new Error(`Database has unknown Prisma migration ${migration.name}.`);
    const acceptedChecksums = new Set([localMigration.checksum, ...(localMigration.checksumVariants ?? [])]);
    if (!acceptedChecksums.has(migration.checksum)) {
      throw new Error(`Prisma migration checksum mismatch for ${migration.name}.`);
    }
  }

  const orderedApplied = sortByName(applied);
  for (let index = 0; index < orderedApplied.length; index += 1) {
    if (orderedApplied[index].name !== local[index]?.name) {
      throw new Error(`Database migration history is not a prefix of local history at ${local[index]?.name ?? localHead}.`);
    }
  }

  return {
    appliedHead: orderedApplied[orderedApplied.length - 1].name,
    pendingMigrations: local.slice(orderedApplied.length),
  };
}

function assertExactMigrationCompatibility(input) {
  const prefix = assertKnownMigrationPrefix(input);
  if (prefix.pendingMigrations.length > 0) {
    throw new Error(`Database is missing local Prisma migration ${prefix.pendingMigrations[0].name}.`);
  }
  return prefix.appliedHead;
}

module.exports = { assertExactMigrationCompatibility, assertKnownMigrationPrefix, migrationChecksumVariants, historicalMigrationChecksums };
