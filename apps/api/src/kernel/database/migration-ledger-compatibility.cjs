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
    if (migration.checksum !== localMigration.checksum) {
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

module.exports = { assertExactMigrationCompatibility, assertKnownMigrationPrefix };
