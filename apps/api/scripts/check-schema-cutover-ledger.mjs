import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { selectDatabaseConnection } from './db-connection-config.mjs';

const require = createRequire(import.meta.url);
const { assertKnownMigrationPrefix, migrationChecksumVariants } = require('../src/kernel/database/migration-ledger-compatibility.cjs');

async function loadLocalMigrations() {
  const candidates = [
    resolve(process.cwd(), 'apps/api/prisma/migrations'),
    resolve(process.cwd(), 'prisma/migrations'),
  ];
  let migrationDirectory;
  for (const candidate of candidates) {
    try {
      const entries = await readdir(candidate, { withFileTypes: true });
      if (entries.some((entry) => entry.isDirectory())) {
        migrationDirectory = candidate;
        break;
      }
    } catch {
      // Try the supported workspace-relative layout before failing clearly.
    }
  }
  if (!migrationDirectory) throw new Error('Could not locate the checked-in Prisma migrations directory.');

  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const migrations = [];
  for (const name of names) {
    const sql = await readFile(join(migrationDirectory, name, 'migration.sql'));
    const checksumVariants = migrationChecksumVariants(sql);
    migrations.push({ name, checksum: checksumVariants[0], checksumVariants });
  }
  return migrations;
}

async function checkLedger() {
  const requiredHead = process.env.PRISM_SCHEMA_REQUIRED_HEAD?.trim();
  if (!requiredHead) throw new Error('PRISM_SCHEMA_REQUIRED_HEAD is required for schema cutover preflight.');

  const localMigrations = await loadLocalMigrations();
  const database = selectDatabaseConnection({ purpose: 'migration' });
  const pool = new Pool({
    connectionString: database.connectionString,
    ssl: database.ssl,
    max: 1,
    connectionTimeoutMillis: 30_000,
  });
  try {
    const result = await pool.query(`
      SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
      FROM public."_prisma_migrations"
      ORDER BY migration_name
    `);
    const appliedMigrations = result.rows.map((row) => ({
      name: row.migration_name,
      checksum: row.checksum,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      rolledBackAt: row.rolled_back_at,
    }));
    const prefix = assertKnownMigrationPrefix({ localMigrations, appliedMigrations, requiredHead });
    console.log(`Migration ledger is a known contiguous prefix through ${prefix.appliedHead}.`);
    console.log(`Pending checked-in migrations: ${prefix.pendingMigrations.length}.`);
    for (const migration of prefix.pendingMigrations) console.log(`PENDING ${migration.name}`);
  } finally {
    await pool.end();
  }
}

checkLedger().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Schema cutover ledger check failed.');
  process.exitCode = 1;
});
