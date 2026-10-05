import { randomUUID } from 'node:crypto';
import { link, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';

import { selectDatabaseConnection } from './db-connection-config.mjs';
import { buildJsonBackupCatalog } from './db-backup-catalog.mjs';
import { loadOwnershipManifest } from './domain-persistence-catalog.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function backupDir(env = process.env) {
  const requested = env.PRISM_DB_BACKUP_DIR?.trim();
  if (requested) return requested;
  return path.resolve(process.cwd(), '..', '..', '.local-dev', 'db-backups');
}

function timestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function quoteIdentifier(identifier) {
  if (typeof identifier !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error('backup catalog contains an invalid PostgreSQL identifier');
  }
  return '"' + identifier + '"';
}

function parseArguments(argv) {
  const unknown = argv.filter((argument) => argument !== '--final');
  if (unknown.length > 0) throw new Error('unknown argument(s): ' + unknown.join(', '));
  return { final: argv.includes('--final') };
}

export async function createJsonDatabaseBackup({
  env = process.env,
  PoolClass = Pool,
  final = false,
  now = new Date(),
  directory = backupDir(env),
  manifest = loadOwnershipManifest(),
} = {}) {
  const database = selectDatabaseConnection({ purpose: 'migration', env });
  const catalog = buildJsonBackupCatalog(manifest, { final });
  const pool = new PoolClass({
    connectionString: database.connectionString,
    ssl: database.ssl,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  let client;
  let transactionStarted = false;
  let temporaryFile;

  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionStarted = true;

    const schemas = catalog.tables.map(({ schema }) => schema);
    const names = catalog.tables.map(({ table }) => table);
    const available = await client.query(
      `SELECT table_schema, table_name
         FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND (table_schema, table_name) IN (
            SELECT expected.schema_name, expected.table_name
              FROM unnest($1::text[], $2::text[]) AS expected(schema_name, table_name)
          )`,
      [schemas, names],
    );
    const found = new Set(available.rows.map(({ table_schema, table_name }) => table_schema + '.' + table_name));
    const missing = catalog.tables
      .map(({ schema, table }) => schema + '.' + table)
      .filter((key) => !found.has(key));
    if (missing.length > 0) {
      throw new Error('JSON backup refused; ownership catalog tables are missing: ' + missing.join(', '));
    }

    const snapshot = {
      createdAt: now.toISOString(),
      source: 'prism db-backup-json',
      schemaMode: final ? 'final' : 'current',
      schemas: catalog.schemas,
      tables: [],
    };

    for (const table of catalog.tables) {
      const qualified = quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.table);
      const result = await client.query('SELECT * FROM ' + qualified);
      snapshot.tables.push({
        schema: table.schema,
        table: table.table,
        rowCount: result.rows.length,
        rows: result.rows,
      });
    }

    await client.query('COMMIT');
    transactionStarted = false;

    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'prism-db-backup-' + timestamp(now) + '.json');
    temporaryFile = file + '.' + randomUUID() + '.tmp';
    let output;
    try {
      output = await open(temporaryFile, 'wx', 0o600);
    } catch (error) {
      temporaryFile = undefined;
      throw error;
    }
    try {
      await output.writeFile(JSON.stringify(snapshot, null, 2), { encoding: 'utf8' });
    } finally {
      await output.close();
    }
    // Linking publishes the complete file atomically and fails if the timestamped
    // destination already exists, so a second run cannot replace an earlier backup.
    await link(temporaryFile, file);
    await unlink(temporaryFile).catch(() => {});
    temporaryFile = undefined;

    return {
      file,
      schemas: snapshot.schemas,
      tableCount: snapshot.tables.length,
      rowCount: snapshot.tables.reduce((sum, table) => sum + table.rowCount, 0),
      schemaMode: snapshot.schemaMode,
    };
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }
    }
    if (temporaryFile) {
      try {
        await unlink(temporaryFile);
      } catch {
        // Preserve the original error.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main() {
  const { final } = parseArguments(process.argv.slice(2));
  const report = await createJsonDatabaseBackup({ final });
  console.log('Backup written: ' + report.file);
  console.log('Schema mode: ' + report.schemaMode);
  console.log('Tables exported: ' + report.tableCount);
  console.log('Rows exported: ' + report.rowCount);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href) {
  main().catch((error) => {
    console.error('Database backup failed: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
